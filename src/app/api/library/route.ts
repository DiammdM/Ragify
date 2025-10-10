import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const documents = await prisma.libraryDocument.findMany({
    orderBy: {
      uploadedAt: "desc",
    },
  });

  const files = documents.map((document) => ({
    id: document.id,
    name: document.name,
    size: document.size,
    status: document.status,
    uploadedAt: document.uploadedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    chunkCount: document.chunkCount,
    lastIndexedAt: document.lastIndexedAt?.toISOString() ?? null,
    embeddingModel: document.embeddingModel ?? null,
  }));

  return NextResponse.json({ files });
}
