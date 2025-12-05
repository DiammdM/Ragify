import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdmin } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminCheck = await ensureAdmin(request.cookies);
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: adminCheck.status }
    );
  }

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
    indexingStage: document.indexingStage,
    indexingProgress: document.indexingProgress ?? 0,
    uploadedAt: document.uploadedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    chunkCount: document.chunkCount,
    lastIndexedAt: document.lastIndexedAt?.toISOString() ?? null,
    embeddingModel: document.embeddingModel ?? null,
  }));

  return NextResponse.json({ files });
}
