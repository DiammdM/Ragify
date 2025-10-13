import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { prisma } from "@/lib/prisma";
import { isAllowedExtension } from "@/lib/library/file-types";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

const toSafeRelativePath = (filename: string, uniqueSuffix: string) => {
  const baseName = path.basename(filename);
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalName = `${uniqueSuffix}-${sanitized}`;
  return path.join("data", "uploads", finalName).replaceAll("\\", "/");
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const entries = formData.getAll("files");

  if (entries.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  await mkdir(UPLOAD_ROOT, { recursive: true });

  const savedFiles: Array<{
    id: string;
    name: string;
    size: number;
    status: string;
    indexingStage: string | null;
    uploadedAt: string;
    updatedAt: string;
  }> = [];

  for (const entry of entries) {
    if (!(entry instanceof File)) {
      continue;
    }

    const fileId = randomUUID();
    const relativePath = toSafeRelativePath(entry.name, fileId);
    const absolutePath = path.join(process.cwd(), relativePath);

    const extension = path.extname(entry.name).slice(1).toLowerCase();
    if (!extension || !isAllowedExtension(extension)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${entry.name}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await writeFile(absolutePath, buffer);

    const document = await prisma.libraryDocument.create({
      data: {
        name: entry.name,
        size: entry.size,
        path: relativePath,
        status: "uploaded",
      },
    });

    savedFiles.push({
      id: document.id,
      name: document.name,
      size: document.size,
      status: document.status,
      indexingStage: document.indexingStage ?? null,
      uploadedAt: document.uploadedAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    });
  }

  if (savedFiles.length === 0) {
    return NextResponse.json(
      { error: "No valid files received" },
      { status: 400 }
    );
  }

  return NextResponse.json({ files: savedFiles });
}
