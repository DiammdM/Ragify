import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { indexDocument } from "@/server/library/indexer";
import type { IndexingStage } from "@/server/library/indexing-stages";
import { ensureAdmin } from "@/lib/auth/user";

const INITIAL_STAGE: IndexingStage = "extracting";
const INITIAL_PROGRESS = 0;

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await ensureAdmin(request.cookies);
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: adminCheck.status }
    );
  }

  const { id } = await params;

  try {
    await prisma.libraryDocument.update({
      where: { id },
      data: {
        status: "indexing",
        indexingStage: INITIAL_STAGE,
        indexingProgress: INITIAL_PROGRESS,
      },
    });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  void indexDocument(id).catch(async (error) => {
    console.error("Failed to index library document", error);
    await prisma.libraryDocument.update({
      where: { id },
      data: {
        status: "uploaded",
        indexingStage: null,
        indexingProgress: 0,
      },
    });
  });

  const document = await prisma.libraryDocument.findUnique({
    where: { id },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      file: {
        id: document.id,
        name: document.name,
        size: document.size,
        status: document.status,
        indexingStage: document.indexingStage,
        indexingProgress: document.indexingProgress ?? 0,
        uploadedAt: document.uploadedAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        chunkCount: document.chunkCount,
        lastIndexedAt: document.lastIndexedAt?.toISOString() ?? null,
        embeddingModel: document.embeddingModel ?? null,
      },
    },
    { status: 202 }
  );
}
