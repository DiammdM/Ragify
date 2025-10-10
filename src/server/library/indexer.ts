import path from "path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { chunkText } from "./chunker";
import { embedTexts, getEmbeddingModelName } from "../embeddings/client";
import { extractTextContent, sanitizeContent } from "./text-extractor";
import { getQdrantClient } from "../qdrant/client";
import type { EmbeddingVector } from "../embeddings/client";
import { DraftModeProvider } from "next/dist/server/async-storage/draft-mode-provider";

const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION ?? "ragify_library_documents";

const ensureCollection = async (vectorSize: number) => {
  const client = getQdrantClient();

  try {
    const collection = await client.getCollection(COLLECTION_NAME);
    const currentSize = collection.config.params.vectors?.size;

    if (currentSize && currentSize !== vectorSize) {
      await client.recreateCollection(COLLECTION_NAME, {
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      });
    }

    return client;
  } catch {
    await getQdrantClient().createCollection(COLLECTION_NAME, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });

    return getQdrantClient();
  }
};

export const deleteExistingVectors = async (documentId: string) => {
  const client = getQdrantClient();

  try {
    await client.delete(COLLECTION_NAME, {
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
  vectors: EmbeddingVector[]
) => {
  const client = getQdrantClient();

  try {
    await client.upsert(COLLECTION_NAME, {
      points: chunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        vector: vectors[index],
        payload: {
          documentId,
          documentName,
          chunkIndex: index,
          content: chunk.content,
          start: chunk.start,
          end: chunk.end,
        },
      })),
    });
  } catch (error) {
    throw error;
  }
};

export async function indexDocument(documentId: string) {
  const document = await prisma.libraryDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error("文档不存在");
  }

  const filePath = path.join(process.cwd(), document.path);
  const rawContent = await extractTextContent(filePath);
  const sanitized = sanitizeContent(rawContent);
  const chunks = chunkText(sanitized);

  if (!chunks.length) {
    throw new Error("文档内容为空或无法解析");
  }

  const vectors = await embedTexts(chunks.map((chunk) => chunk.content));
  if (!vectors.length) {
    throw new Error("向量生成失败");
  }

  const vectorSize = vectors[0]?.length ?? 0;
  if (!vectorSize) {
    throw new Error("无法确定向量维度");
  }

  try {
    await ensureCollection(vectorSize);
    await deleteExistingVectors(document.id);
    await upsertChunks(document.id, document.name, chunks, vectors);
  } catch (error) {
    if (error instanceof Error && /fetch failed/i.test(error.message)) {
      throw new Error(
        "无法连接到 Qdrant，请确认 QDRANT_URL、QDRANT_API_KEY 配置正确且服务可访问。"
      );
    }
    throw error;
  }

  const updated = await prisma.libraryDocument.update({
    where: { id: document.id },
    data: {
      status: "indexed",
      chunkCount: chunks.length,
      lastIndexedAt: new Date(),
      embeddingModel: getEmbeddingModelName(),
    },
  });

  return updated;
}
