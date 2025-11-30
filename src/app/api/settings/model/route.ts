import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { primeUserModelSettingsCache } from "@/server/models/user-settings";

const MODEL_KEYS = ["llama", "qwen", "gemma", "ollama"] as const;
type ModelKey = (typeof MODEL_KEYS)[number];
const MODEL_KEY_SET = new Set<ModelKey>(MODEL_KEYS);

type ParsedPayload = {
  modelKey: ModelKey;
  apiKey: string | null;
  chunkSize: number;
  ollamaHost: string | null;
  ollamaPort: string | null;
  ollamaModel: string | null;
};

const parsePayload = (payload: unknown): ParsedPayload | { error: string } => {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload" };
  }

  const modelKey =
    "modelKey" in payload && typeof (payload as { modelKey?: unknown }).modelKey === "string"
      ? (payload as { modelKey: string }).modelKey
      : "";

  const chunkSizeRaw =
    "chunkSize" in payload && typeof (payload as { chunkSize?: unknown }).chunkSize === "number"
      ? (payload as { chunkSize: number }).chunkSize
      : Number.NaN;

  const apiKey =
    "apiKey" in payload && typeof (payload as { apiKey?: unknown }).apiKey === "string"
      ? (payload as { apiKey: string }).apiKey.trim()
      : "";

  const ollamaHost =
    "ollamaHost" in payload && typeof (payload as { ollamaHost?: unknown }).ollamaHost === "string"
      ? (payload as { ollamaHost: string }).ollamaHost.trim()
      : "";

  const ollamaPort =
    "ollamaPort" in payload && typeof (payload as { ollamaPort?: unknown }).ollamaPort === "string"
      ? (payload as { ollamaPort: string }).ollamaPort.trim()
      : "";

  const ollamaModel =
    "ollamaModel" in payload && typeof (payload as { ollamaModel?: unknown }).ollamaModel === "string"
      ? (payload as { ollamaModel: string }).ollamaModel.trim()
      : "";

  if (!MODEL_KEY_SET.has(modelKey as ModelKey)) {
    return { error: "Invalid model key." };
  }

  if (!Number.isFinite(chunkSizeRaw) || chunkSizeRaw < 200 || chunkSizeRaw > 2000) {
    return { error: "Chunk size must be between 200 and 2000." };
  }

  return {
    modelKey: modelKey as ModelKey,
    apiKey: apiKey || null,
    chunkSize: Math.round(chunkSizeRaw),
    ollamaHost: ollamaHost || null,
    ollamaPort: ollamaPort || null,
    ollamaModel: ollamaModel || null,
  };
};

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request.cookies);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.userModelSettings.findUnique({
      where: { userId },
    });

    return NextResponse.json({ settings: settings ?? null });
  } catch (error) {
    console.error("Failed to load model settings", error);
    return NextResponse.json(
      { error: "Failed to load settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request.cookies);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parsePayload(payload);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const isOllama = parsed.modelKey === "ollama";

  try {
    const settings = await prisma.userModelSettings.upsert({
      where: { userId },
      update: {
        modelKey: parsed.modelKey,
        apiKey: parsed.apiKey,
        chunkSize: parsed.chunkSize,
        ollamaHost: isOllama ? parsed.ollamaHost : null,
        ollamaPort: isOllama ? parsed.ollamaPort : null,
        ollamaModel: isOllama ? parsed.ollamaModel : null,
      },
      create: {
        userId,
        modelKey: parsed.modelKey,
        apiKey: parsed.apiKey,
        chunkSize: parsed.chunkSize,
        ollamaHost: isOllama ? parsed.ollamaHost : null,
        ollamaPort: isOllama ? parsed.ollamaPort : null,
        ollamaModel: isOllama ? parsed.ollamaModel : null,
      },
    });

    primeUserModelSettingsCache(userId, settings);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Failed to save model settings", error);
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 }
    );
  }
}
