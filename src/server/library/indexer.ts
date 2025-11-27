import path from "path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { chunkText } from "./chunker";
import { embedTexts, getEmbeddingModelName } from "../embeddings/client";
import { extractTextContent, sanitizeContent } from "./text-extractor";
import { getQdrantClient } from "../qdrant/client";
import type { EmbeddingVector } from "../embeddings/client";
import { type IndexingStage } from "./indexing-stages";
import { LIBRARY_COLLECTION_NAME } from "../qdrant/constants";
import { normalizeQdrantError } from "../qdrant/errors";

type QdrantVectorConfig =
  | { size: number; distance?: string | undefined }
  | Record<string, { size: number; distance?: string | undefined }>
  | number
  | undefined;

type VectorParamsLike = { size?: number | undefined };

const extractVectorSize = (config: QdrantVectorConfig) => {
  if (!config) {
    return undefined;
  }

  if (typeof config === "number") {
    return config;
  }

  if (typeof config === "object") {
    if ("size" in config && typeof (config as VectorParamsLike).size === "number") {
      return (config as VectorParamsLike).size;
    }

    for (const vectorParams of Object.values(config as Record<string, unknown>)) {
      if (
        vectorParams &&
        typeof vectorParams === "object" &&
        "size" in vectorParams &&
        typeof (vectorParams as VectorParamsLike).size === "number"
      ) {
        return (vectorParams as VectorParamsLike).size;
      }
    }
  }

  return undefined;
};

const usesNamedVectors = (config: QdrantVectorConfig) => {
  if (!config || typeof config === "number") {
    return false;
  }

  if (typeof config !== "object") {
    return false;
  }

  return !("size" in config);
};

const parsePositiveInteger = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const DEFAULT_QDRANT_UPSERT_BATCH_SIZE = 32;
const QDRANT_UPSERT_BATCH_SIZE =
  parsePositiveInteger(process.env.QDRANT_UPSERT_BATCH_SIZE) ??
  DEFAULT_QDRANT_UPSERT_BATCH_SIZE;

const DEFAULT_EMBEDDING_BATCH_SIZE = 12;
const EMBEDDING_BATCH_SIZE =
  parsePositiveInteger(process.env.INDEXING_BATCH_SIZE) ??
  DEFAULT_EMBEDDING_BATCH_SIZE;

const PROGRESS_AFTER_EXTRACTION = 5;
const PROGRESS_AFTER_CHUNKING = 10;
const EMBEDDING_PROGRESS_END = 90;
const PROGRESS_BEFORE_SAVING = 95;
const PROGRESS_COMPLETE = 100;

const ensureCollection = async (vectorSize: number) => {
  const client = getQdrantClient();
  const desiredConfig = {
    vectors: {
      size: vectorSize,
      distance: "Cosine" as const,
    },
  };

  try {
    const collection = await client.getCollection(LIBRARY_COLLECTION_NAME);
    const currentVectors = collection.config.params.vectors as
      | QdrantVectorConfig
      | undefined;
    const currentSize = extractVectorSize(currentVectors);

    if (usesNamedVectors(currentVectors) || currentSize !== vectorSize) {
      await client.recreateCollection(LIBRARY_COLLECTION_NAME, desiredConfig);
    }

    return client;
  } catch {
    await client.createCollection(LIBRARY_COLLECTION_NAME, desiredConfig);
    return client;
  }
};

export const deleteExistingVectors = async (documentId: string) => {
  const client = getQdrantClient();

  try {
    await client.delete(LIBRARY_COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "documentId",
            match: {
              value: documentId,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.warn("Failed to delete vectors from Qdrant", error);
  }
};

const upsertChunks = async (
  documentId: string,
  documentName: string,
  chunks: ReturnType<typeof chunkText>,
  vectors: EmbeddingVector[],
  offset = 0
) => {
  const client = getQdrantClient();
  const expectedSize = vectors[0]?.length ?? 0;

  try {
    const batchSize = Math.max(1, QDRANT_UPSERT_BATCH_SIZE);

    for (
      let startIndex = 0;
      startIndex < chunks.length;
      startIndex += batchSize
    ) {
      const batchPoints = chunks
        .slice(startIndex, startIndex + batchSize)
        .map((chunk, index) => {
          const vectorIndex = startIndex + index;
          const vector = vectors[vectorIndex];

          if (!vector?.length) {
            throw new Error(
              `Missing embedding vector for chunk ${offset + vectorIndex}. Expected ${chunks.length} vectors, received ${vectors.length}.`
            );
          }

          if (expectedSize && vector.length !== expectedSize) {
            throw new Error(
              `Embedding dimension mismatch for chunk ${offset + vectorIndex}. Expected ${expectedSize}, got ${vector.length}.`
            );
          }

          return {
            id: crypto.randomUUID(),
            vector,
            payload: {
              documentId,
              documentName,
              chunkIndex: offset + vectorIndex,
              content: chunk.content,
              start: chunk.start,
              end: chunk.end,
            },
          };
        });

      await client.upsert(LIBRARY_COLLECTION_NAME, { points: batchPoints });
    }
  } catch (error) {
    throw error;
  }
};

const updateIndexingState = async (
  documentId: string,
  {
    stage,
    progress,
  }: { stage?: IndexingStage | null; progress?: number | null }
) => {
  const data: {
    indexingStage?: IndexingStage | null;
    indexingProgress?: number | null;
  } = {};

  if (stage !== undefined) {
    data.indexingStage = stage;
  }

  if (progress !== undefined) {
    data.indexingProgress =
      progress === null
        ? null
        : Math.max(0, Math.min(100, Math.round(progress)));
  }

  if (!("indexingStage" in data) && !("indexingProgress" in data)) {
    return;
  }

  await prisma.libraryDocument.update({
    where: { id: documentId },
    data,
  });
};

export async function indexDocument(documentId: string) {
  const document = await prisma.libraryDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error("Document not found.");
  }

  const filePath = path.join(process.cwd(), document.path);
  await updateIndexingState(document.id, { stage: "extracting", progress: 0 });
  const rawContent = await extractTextContent(filePath);
  await updateIndexingState(document.id, {
    progress: PROGRESS_AFTER_EXTRACTION,
  });
  const sanitized = sanitizeContent(rawContent);

  await updateIndexingState(document.id, {
    stage: "chunking",
    progress: PROGRESS_AFTER_CHUNKING,
  });
  const chunks = chunkText(sanitized);

  if (!chunks.length) {
    throw new Error("Document content is empty or could not be parsed.");
  }

  await updateIndexingState(document.id, {
    stage: "embedding",
    progress: PROGRESS_AFTER_CHUNKING,
  });

  const totalChunks = chunks.length;
  const embeddingProgressRange = Math.max(
    0,
    EMBEDDING_PROGRESS_END - PROGRESS_AFTER_CHUNKING
  );

  let processedChunks = 0;
  let lastProgress = PROGRESS_AFTER_CHUNKING;

  const batchContents: string[] = [];
  const allVectors: EmbeddingVector[] = [];

  const flushBatch = async () => {
    if (!batchContents.length) {
      return;
    }

    const vectors = await embedTexts(batchContents);
    if (!vectors.length) {
      throw new Error("Failed to generate embeddings for the document.");
    }
    if (vectors.length !== batchContents.length) {
      throw new Error("Embedding output mismatch for chunk batch.");
    }

    allVectors.push(...vectors);
    processedChunks += batchContents.length;
    batchContents.length = 0;

    if (embeddingProgressRange > 0) {
      const progress =
        PROGRESS_AFTER_CHUNKING +
        Math.floor((processedChunks / totalChunks) * embeddingProgressRange);

      if (progress > lastProgress) {
        await updateIndexingState(document.id, { progress });
        lastProgress = progress;
      }
    }
  };

  for (const chunk of chunks) {
    batchContents.push(chunk.content);

    if (batchContents.length >= EMBEDDING_BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();

  if (allVectors.length !== chunks.length) {
    throw new Error(
      `Embedding output mismatch: generated ${allVectors.length} vectors for ${chunks.length} chunks.`
    );
  }

  const vectorSize = allVectors[0]?.length ?? 0;
  if (!vectorSize) {
    throw new Error("Unable to determine embedding vector dimension.");
  }

  await updateIndexingState(document.id, {
    stage: "saving",
    progress: PROGRESS_BEFORE_SAVING,
  });

  try {
    await ensureCollection(vectorSize);
    await deleteExistingVectors(document.id);
    await upsertChunks(document.id, document.name, chunks, allVectors);
  } catch (error) {
    throw normalizeQdrantError(error);
  }

  const updated = await prisma.libraryDocument.update({
    where: { id: document.id },
    data: {
      status: "indexed",
      indexingStage: null,
      indexingProgress: PROGRESS_COMPLETE,
      chunkCount: totalChunks,
      lastIndexedAt: new Date(),
      embeddingModel: getEmbeddingModelName(),
    },
  });

  return updated;
}
