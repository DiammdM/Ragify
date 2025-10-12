import fs from "fs";
import path from "path";
import type { TransformerPipeline, Tensor } from "@xenova/transformers";
import type transformers from "@xenova/transformers";

export type EmbeddingVector = number[];

type FeatureExtractionPipeline = TransformerPipeline;

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

type TransformersModule = typeof transformers;

const configureTransformersEnv = (mod: TransformersModule) => {
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

let transformersModulePromise: Promise<TransformersModule> | undefined;
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

const loadTransformersModule = async () => {
  if (!transformersModulePromise) {
    transformersModulePromise = import("@xenova/transformers").then((mod) => {
      const typedModule = mod as TransformersModule;
      configureTransformersEnv(typedModule);
      return typedModule;
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
        "Failed to load embedding model (connection timeout). Ensure the server can reach huggingface.co or cache Xenova/bge-m3 including onnx/sentence_transformers_int8.onnx inside TRANSFORMERS_CACHE before retrying."
      );
    }

    if (/Failed to fetch/i.test(error.message)) {
      return new Error(
        "Failed to download embedding model. Check the network connection or provide HF_TOKEN before retrying."
      );
    }

    if (/model_path must not be empty/i.test(error.message)) {
      return new Error(
        "Failed to load ONNX model. Verify onnxruntime-node is installed or clear the cache and try again."
      );
    }

    if (/sharp/i.test(error.message)) {
      return new Error(
        "Sharp failed to initialize while loading @xenova/transformers. Install a platform-compatible sharp build as described in the README."
      );
    }

    if (error.message.includes("Cannot find module '@xenova/transformers'")) {
      return new Error(
        "The @xenova/transformers dependency is missing. Run `npm install` and retry."
      );
    }
  }

  return error instanceof Error
    ? error
    : new Error("Embedding model initialization failed and the error message is unavailable.");
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
      throw new Error(
        "Embedding pipeline returned an empty vector. Confirm the input text is valid."
      );
    }

    vectors.push(vector);
  }

  return vectors;
}

export function getEmbeddingModelName() {
  return MODEL_ID;
}
