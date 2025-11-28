import fs from "fs";
import path from "path";
import type { Tensor } from "@xenova/transformers";
import {
  getTransformersModule,
  TRANSFORMERS_CACHE_DIR,
} from "../embeddings/client";
import type { RetrievedChunk } from "../library/search";

const DEFAULT_CROSS_ENCODER_MODEL =
  "Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2";
const CROSS_ENCODER_MODEL_ID =
  process.env.CROSS_ENCODER_MODEL ?? DEFAULT_CROSS_ENCODER_MODEL;
const CROSS_ENCODER_MODEL_FILE =
  process.env.CROSS_ENCODER_MODEL_FILE ?? "model";
const CROSS_ENCODER_QUANTIZED =
  process.env.CROSS_ENCODER_MODEL_QUANTIZED === "true"
    ? true
    : process.env.CROSS_ENCODER_MODEL_QUANTIZED === "false"
    ? false
    : false;
const CROSS_ENCODER_MODEL_PATH = process.env.CROSS_ENCODER_MODEL_PATH;
const FALLBACK_CACHE_DIRS = [
  "Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2",
  "cross-encoder/ms-marco-MiniLM-L-6-v2",
];
const DEFAULT_LOCAL_FILES_ONLY =
  process.env.TRANSFORMERS_LOCAL_FILES_ONLY === "false" ? false : true;

const CROSS_ENCODER_LOCAL_FILES_ONLY =
  process.env.CROSS_ENCODER_LOCAL_FILES_ONLY === "true"
    ? true
    : process.env.CROSS_ENCODER_LOCAL_FILES_ONLY === "false"
    ? false
    : DEFAULT_LOCAL_FILES_ONLY;

const CROSS_ENCODER_ALLOW_REMOTE =
  process.env.CROSS_ENCODER_ALLOW_REMOTE === "true"
    ? true
    : process.env.CROSS_ENCODER_ALLOW_REMOTE === "false"
    ? false
    : !CROSS_ENCODER_LOCAL_FILES_ONLY;

type CrossEncoderResources = {
  tokenizer: {
    (
      text: string,
      options: {
        text_pair: string;
        padding: boolean;
        truncation: boolean;
      }
    ): Record<string, unknown>;
  };
  model: {
    (inputs: Record<string, unknown>): Promise<{ logits: Tensor }>;
  };
};

let rerankerPromise: Promise<CrossEncoderResources> | undefined;

const clampLimit = (requested?: number) => {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return 3;
  }

  const integer = Math.floor(requested);
  return Math.min(Math.max(integer, 1), 10);
};

const wrapCrossEncoderError = (error: unknown) => {
  if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
    return new Error(
      "Failed to download cross-encoder weights. Run `huggingface-cli download Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2 --local-dir .cache/transformers/Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2` or set CROSS_ENCODER_ALLOW_REMOTE=true with network access."
    );
  }

  if (
    error instanceof Error &&
    /local_files_only=true/i.test(error.message)
  ) {
    return new Error(
      'Cross-encoder weights were not found in the local cache. Download them with `huggingface-cli download Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2 --local-dir .cache/transformers/Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2` or set CROSS_ENCODER_LOCAL_FILES_ONLY=false (or TRANSFORMERS_ALLOW_REMOTE=true) to allow remote downloads.'
    );
  }

  if (
    error instanceof Error &&
    /Cannot find module '@xenova\/transformers'/.test(error.message)
  ) {
    return new Error(
      "The @xenova/transformers dependency is missing. Install dependencies before running the reranker."
    );
  }

  return error instanceof Error
    ? error
    : new Error("Cross-encoder reranking failed for an unknown reason.");
};

const hasCachedModel = (repoId: string) => {
  const tokenizerPath = path.join(
    TRANSFORMERS_CACHE_DIR,
    repoId.replace(/^\.\/+/, ""),
    "tokenizer.json"
  );

  return fs.existsSync(tokenizerPath);
};

const normalizeManualPath = (manualPath: string) => {
  if (!manualPath) {
    return undefined;
  }

  if (path.isAbsolute(manualPath)) {
    const relative = path.relative(TRANSFORMERS_CACHE_DIR, manualPath);
    if (!relative.startsWith("..")) {
      return relative;
    }
    return undefined;
  }

  if (manualPath.startsWith("./") || manualPath.startsWith("../")) {
    const resolved = path.resolve(process.cwd(), manualPath);
    return normalizeManualPath(resolved);
  }

  return manualPath;
};

const resolveModelIdentifier = () => {
  const manualPath = normalizeManualPath(
    CROSS_ENCODER_MODEL_PATH?.trim() ?? ""
  );

  if (manualPath) {
    if (hasCachedModel(manualPath)) {
      return manualPath;
    }

    throw new Error(
      `Configured CROSS_ENCODER_MODEL_PATH (${manualPath}) does not contain tokenizer.json inside ${TRANSFORMERS_CACHE_DIR}.`
    );
  }

  const candidates = [CROSS_ENCODER_MODEL_ID, ...FALLBACK_CACHE_DIRS];

  for (const repoId of candidates) {
    if (hasCachedModel(repoId)) {
      return repoId;
    }
  }

  return CROSS_ENCODER_MODEL_ID;
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

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const softmax = (values: number[]) => {
  if (!values.length) {
    return values;
  }

  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0);
  return sum === 0 ? values : exps.map((value) => value / sum);
};

const toRerankScore = (logits: Tensor) => {
  const values = tensorValues(logits);
  if (!values.length) {
    return 0;
  }

  const lastDim = logits.dims[logits.dims.length - 1] ?? values.length;

  if (lastDim === 1) {
    return sigmoid(values[0]);
  }

  const probabilities = softmax(values.slice(0, lastDim));
  return probabilities[probabilities.length - 1] ?? probabilities[0] ?? 0;
};

const getCrossEncoderResources = async () => {
  if (!rerankerPromise) {
    rerankerPromise = (async () => {
      const transformers = await getTransformersModule();
      const previousAllowRemote = transformers.env.allowRemoteModels;
      const shouldTemporarilyAllowRemote =
        CROSS_ENCODER_ALLOW_REMOTE && previousAllowRemote === false;

      if (shouldTemporarilyAllowRemote) {
        transformers.env.allowRemoteModels = true;
      }

      try {
        const modelIdentifier = resolveModelIdentifier();
        const tokenizer = await transformers.AutoTokenizer.from_pretrained(
          modelIdentifier,
          {
            local_files_only: CROSS_ENCODER_LOCAL_FILES_ONLY,
          }
        );
        const model =
          await transformers.AutoModelForSequenceClassification.from_pretrained(
            modelIdentifier,
            {
              local_files_only: CROSS_ENCODER_LOCAL_FILES_ONLY,
              model_file_name: CROSS_ENCODER_MODEL_FILE,
              quantized: CROSS_ENCODER_QUANTIZED,
            }
          );

        return { tokenizer, model };
      } finally {
        if (shouldTemporarilyAllowRemote) {
          transformers.env.allowRemoteModels = previousAllowRemote;
        }
      }
    })();
  }

  try {
    return await rerankerPromise;
  } catch (error) {
    rerankerPromise = undefined;
    throw wrapCrossEncoderError(error);
  }
};

type RerankOptions = {
  limit?: number;
};

const parseWeight = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
};

const CROSS_ENCODER_WEIGHT = parseWeight(
  process.env.CROSS_ENCODER_WEIGHT,
  0.7
);

const combineScores = (
  chunks: RetrievedChunk[],
  crossWeight = CROSS_ENCODER_WEIGHT
) => {
  if (!chunks.length) {
    return [];
  }

  const crossScores = chunks.map((chunk) => chunk.crossScore ?? 0);
  const vectorScores = chunks.map((chunk) => chunk.vectorScore ?? 0);

  const crossMin = Math.min(...crossScores);
  const crossMax = Math.max(...crossScores);
  const vectorMin = Math.min(...vectorScores);
  const vectorMax = Math.max(...vectorScores);

  const normalize = (value: number, min: number, max: number) =>
    max > min ? (value - min) / (max - min) : 1;

  return chunks
    .map((chunk, index) => {
      const crossNormalized = normalize(
        crossScores[index] ?? 0,
        crossMin,
        crossMax
      );
      const vectorNormalized = normalize(
        vectorScores[index] ?? 0,
        vectorMin,
        vectorMax
      );
      const combined =
        crossWeight * crossNormalized +
        (1 - crossWeight) * vectorNormalized;

      return {
        ...chunk,
        score: combined,
      };
    })
    .sort((a, b) => b.score - a.score);
};

export async function rerankChunks(
  question: string,
  chunks: RetrievedChunk[],
  options?: RerankOptions
) {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question text is required for reranking.");
  }

  if (!chunks.length) {
    return [];
  }

  const { tokenizer, model } = await getCrossEncoderResources();
  const limit = clampLimit(options?.limit);
  const scored: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const content = chunk.content ?? "";
    const inputs = tokenizer(trimmed, {
      text_pair: content,
      padding: true,
      truncation: true,
    });

    try {
      const output = await model(inputs);
      const score = toRerankScore(output.logits);

      scored.push({
        ...chunk,
        crossScore: score,
      });
    } catch (error) {
      throw wrapCrossEncoderError(error);
    }
  }

  const reranked = combineScores(scored).slice(
    0,
    Math.min(limit, scored.length)
  );

  const final: RetrievedChunk[] = [];
  const seen = new Set<string>();

  const pushUnique = (chunk: RetrievedChunk | undefined) => {
    if (!chunk) {
      return;
    }

    if (seen.has(chunk.id)) {
      return;
    }

    final.push(chunk);
    seen.add(chunk.id);
  };

  // Always include the top vector-scored chunk for coverage.
  pushUnique(chunks[0]);

  for (const chunk of reranked) {
    if (final.length >= limit) {
      break;
    }
    pushUnique(chunk);
  }

  if (final.length < limit) {
    for (const chunk of chunks) {
      if (final.length >= limit) {
        break;
      }
      pushUnique(chunk);
    }
  }

  return final.slice(0, Math.min(limit, final.length));
}
