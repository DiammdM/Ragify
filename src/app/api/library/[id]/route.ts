import { NextResponse } from "next/server";
import path from "path";
import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = new Set(["uploaded", "indexing", "indexed"]);

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("status" in payload) ||
    typeof (payload as { status: unknown }).status !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing status in request body" },
      { status: 400 }
    );
  }

  const nextStatus = (payload as { status: string }).status;
  if (!VALID_STATUSES.has(nextStatus)) {
    return NextResponse.json({ error: "Unsupported status" }, { status: 400 });
  }

  try {
    const document = await prisma.libraryDocument.update({
      where: { id },
      data: {
        status: nextStatus,
      },
    });

    return NextResponse.json({
      file: {
        id: document.id,
        name: document.name,
        size: document.size,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const document = await prisma.libraryDocument.delete({
      where: { id },
    });

    const absolutePath = path.join(process.cwd(), document.path);

    try {
      await unlink(absolutePath);
    } catch {
      // File might have been removed manually; ignore missing-file errors.
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}
