import fs from "fs";
import path from "path";
import type { Pipeline, Tensor } from "@xenova/transformers";

export type EmbeddingVector = number[];

type FeatureExtractionPipeline = Pipeline<"feature-extraction">;

const CACHE_DIR = path.resolve(
  process.cwd(),
  process.env.TRANSFORMERS_CACHE ?? ".cache/transformers"
);

const DEFAULT_MODEL_ID = "Xenova/bge-m3";
const DEFAULT_MODEL_FILE_NAME = "sentence_transformers_int8";
const DEFAULT_MODEL_QUANTIZED = false;
const MODEL_ID = process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL_ID;
const MODEL_FILE_NAME =
  process.env.EMBEDDING_MODEL_FILE ?? DEFAULT_MODEL_FILE_NAME;
const MODEL_QUANTIZED =
  process.env.EMBEDDING_MODEL_QUANTIZED === "true"
    ? true
    : process.env.EMBEDDING_MODEL_QUANTIZED === "false"
      ? false
      : DEFAULT_MODEL_QUANTIZED;
const LOCAL_FILES_ONLY =
  process.env.TRANSFORMERS_LOCAL_FILES_ONLY === "false" ? false : true;

let transformersModulePromise:
  | Promise<typeof import("@xenova/transformers")>
  | undefined;
let pipelinePromise: Promise<FeatureExtractionPipeline> | undefined;

const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

const parsePositiveInteger = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const configureTransformersEnv = (
  mod: typeof import("@xenova/transformers")
) => {
  ensureCacheDir();

  mod.env.cacheDir = CACHE_DIR;
  mod.env.localModelPath = CACHE_DIR;
  mod.env.allowLocalModels = true;

  const allowRemoteEnv = process.env.TRANSFORMERS_ALLOW_REMOTE;
  mod.env.allowRemoteModels =
    allowRemoteEnv === "true"
      ? true
      : allowRemoteEnv === "false"
        ? false
        : !LOCAL_FILES_ONLY;

  const onnx = mod.env.backends?.onnx?.wasm;
  if (onnx) {
    const threads = parsePositiveInteger(process.env.TRANSFORMERS_WASM_THREADS);
    if (threads) {
      onnx.numThreads = threads;
    }

    if (process.env.TRANSFORMERS_WASM_SIMD === "false") {
      onnx.simd = false;
    }
  }
};

const loadTransformersModule = async () => {
  if (!transformersModulePromise) {
    transformersModulePromise = import("@xenova/transformers").then((mod) => {
      configureTransformersEnv(mod);
      return mod;
    });
  }

  return transformersModulePromise;
};

const tensorValues = (tensor: Tensor): number[] => {
  if (Array.isArray(tensor.data)) {
    return tensor.data.slice() as number[];
  }

  if (
    tensor.data instanceof Float32Array ||
    tensor.data instanceof Float64Array
  ) {
    return Array.from(tensor.data);
  }

  if (tensor.data instanceof Int32Array) {
    return Array.from(tensor.data).map((value) => value as number);
  }

  return Array.from(tensor.data as Iterable<number>);
};

const tensorToVectors = (tensor: Tensor): EmbeddingVector[] => {
  const dims = tensor.dims ?? [];
  const values = tensorValues(tensor);

  if (!dims.length || dims.length === 1) {
    return [values];
  }

  const [batch, ...rest] = dims;
  const vectorSize = rest.reduce((acc, dim) => acc * dim, 1);
  const vectors: EmbeddingVector[] = [];

  for (let index = 0; index < batch; index += 1) {
    const start = index * vectorSize;
    const end = start + vectorSize;
    vectors.push(values.slice(start, end));
  }

  return vectors;
};

const wrapPipelineError = (error: unknown) => {
  if (error instanceof Error) {
    if (/connect timeout/i.test(error.message)) {
      return new Error(
        "无法加载嵌入模型（连接超时）。请确认服务器可以访问 huggingface.co，或已在 TRANSFORMERS_CACHE 中缓存 Xenova/bge-m3（包含 onnx/sentence_transformers_int8.onnx）后重试。"
      );
    }

    if (/Failed to fetch/i.test(error.message)) {
      return new Error(
        "下载嵌入模型失败，请检查网络连接或设置 HF_TOKEN 后重试。"
      );
    }

    if (/model_path must not be empty/i.test(error.message)) {
      return new Error(
        "加载 ONNX 模型失败，请确认已安装 onnxruntime-node 依赖，或删除缓存后重试。"
      );
    }

    if (/sharp/i.test(error.message)) {
      return new Error(
        "加载 @xenova/transformers 时 sharp 初始化失败。请根据 README 提示安装与平台匹配的 sharp。"
      );
    }

    if (error.message.includes("Cannot find module '@xenova/transformers'")) {
      return new Error(
        "未找到 @xenova/transformers 依赖。请运行 `npm install` 后重试。"
      );
    }
  }

  return error instanceof Error
    ? error
    : new Error("嵌入模型加载失败，错误信息未知。");
};

const createPipeline = async () => {
  const transformers = await loadTransformersModule();
  const options: Record<string, unknown> = {
    model_file_name: MODEL_FILE_NAME,
    quantized: MODEL_QUANTIZED,
  };

  if (LOCAL_FILES_ONLY) {
    options.local_files_only = true;
  }

  return transformers.pipeline("feature-extraction", MODEL_ID, options);
};

export async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = createPipeline();
  }

  try {
    return await pipelinePromise;
  } catch (error) {
    pipelinePromise = undefined;
    throw wrapPipelineError(error);
  }
}

export async function embedTexts(texts: string[]): Promise<EmbeddingVector[]> {
  if (!texts.length) {
    return [];
  }

  const pipeline = await getEmbeddingPipeline();
  const vectors: EmbeddingVector[] = [];

  for (const text of texts) {
    let output: Tensor;

    try {
      output = await pipeline(text, {
        pooling: "mean",
        normalize: true,
      });
    } catch (error) {
      throw wrapPipelineError(error);
    }

    const [vector] = tensorToVectors(output);
    if (!vector?.length) {
      throw new Error("嵌入模型返回空向量，请检查输入文本是否有效。");
    }

    vectors.push(vector);
  }

  return vectors;
}

export function getEmbeddingModelName() {
  return MODEL_ID;
}
