import { embedTexts } from "../embeddings/client";
import { getQdrantClient } from "../qdrant/client";
import { LIBRARY_COLLECTION_NAME } from "../qdrant/constants";
import { normalizeQdrantError } from "../qdrant/errors";
import { prisma } from "@/lib/prisma";

const DEFAULT_RESULT_LIMIT = 10;

export type RetrievedChunk = {
  id: string;
  score: number;
  vectorScore: number;
  crossScore?: number | null;
  content: string;
  documentId: string | null;
  documentName: string | null;
  source: string | null;
  chunkIndex: number | null;
  start: number | null;
  end: number | null;
};

type SearchOptions = {
  limit?: number;
};

const clampLimit = (requested?: number) => {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return DEFAULT_RESULT_LIMIT;
  }

  const integer = Math.floor(requested);
  return Math.min(Math.max(integer, 1), 50);
};

const toStringId = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return "";
};

const toNumberOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toStringOrNull = (value: unknown) =>
  typeof value === "string" ? value : null;

export async function searchLibraryChunks(
  question: string,
  options?: SearchOptions
): Promise<RetrievedChunk[]> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question text is required.");
  }

  const [vector] = await embedTexts([trimmed]);
  const client = getQdrantClient();

  try {
    const points = await client.search(LIBRARY_COLLECTION_NAME, {
      vector,
      limit: clampLimit(options?.limit),
      with_payload: true,
      with_vector: false,
    });

    const chunks = (points ?? []).map((point) => {
      const payload = (point.payload ?? {}) as Record<string, unknown>;

      const vectorScore =
        typeof point.score === "number" && Number.isFinite(point.score)
          ? point.score
          : 0;

      return {
        id: toStringId(point.id),
        score: vectorScore,
        vectorScore,
        content: toStringOrNull(payload.content) ?? "",
        documentId: toStringOrNull(payload.documentId),
        documentName: toStringOrNull(payload.documentName),
        source: toStringOrNull(payload.source),
        chunkIndex: toNumberOrNull(payload.chunkIndex),
        start: toNumberOrNull(payload.start),
        end: toNumberOrNull(payload.end),
      };
    });

    const unresolvedDocumentIds = Array.from(
      new Set(
        chunks
          .filter((chunk) => !chunk.documentName && chunk.documentId)
          .map((chunk) => chunk.documentId as string)
      )
    );

    if (unresolvedDocumentIds.length === 0) {
      return chunks;
    }

    const documents = await prisma.libraryDocument.findMany({
      where: {
        id: {
          in: unresolvedDocumentIds,
        },
      },
      select: {
        id: true,
        name: true,
        path: true,
      },
    });

    const documentMap = new Map(
      documents.map((document) => [document.id, document])
    );

    return chunks.map((chunk) => {
      if (!chunk.documentId) {
        return chunk;
      }

      const document = documentMap.get(chunk.documentId);
      if (!document) {
        return chunk;
      }

      return {
        ...chunk,
        documentName: chunk.documentName ?? document.name,
        source: chunk.source ?? document.path,
      };
    });
  } catch (error) {
    throw normalizeQdrantError(error);
  }
}
