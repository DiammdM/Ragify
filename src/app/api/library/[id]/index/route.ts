import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { indexDocument } from "@/server/library/indexer";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.libraryDocument.update({
      where: { id },
      data: {
        status: "indexing",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const document = await indexDocument(id);

    return NextResponse.json({
      file: {
        id: document.id,
        name: document.name,
        size: document.size,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        chunkCount: document.chunkCount,
        lastIndexedAt: document.lastIndexedAt?.toISOString() ?? null,
        embeddingModel: document.embeddingModel ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to index document";

    await prisma.libraryDocument.update({
      where: { id },
      data: {
        status: "uploaded",
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
