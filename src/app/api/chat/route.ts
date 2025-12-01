import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateChatAnswerFromChunks,
  generateDirectAnswer,
  type ConversationTurn,
} from "@/server/answers/generator";
import { searchLibraryChunks } from "@/server/library/search";
import { rerankChunks } from "@/server/rerank/cross-encoder";
import { getSessionUserId } from "@/lib/auth/session";
import { getUserModelSettingsCached } from "@/server/models/user-settings";

export const runtime = "nodejs";

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
};

const MIN_CROSS_SCORE = 0.35;

const filterRelevantChunks = (chunks: Awaited<ReturnType<typeof rerankChunks>>) =>
  chunks.filter((chunk) => (chunk.crossScore ?? 0) >= MIN_CROSS_SCORE);

const sanitizeMessages = (payload: unknown): ConversationTurn[] => {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("messages" in payload) ||
    !Array.isArray((payload as { messages: unknown }).messages)
  ) {
    return [];
  }

  const raw = (payload as { messages: unknown[] }).messages;

  return raw
    .map((message) => {
      const item = message as IncomingMessage;
      const role =
        item.role === "user" || item.role === "assistant" ? item.role : null;
      const content =
        typeof item.content === "string" ? item.content.trim() : "";

      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter((message): message is ConversationTurn => Boolean(message))
    .slice(-12);
};

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = sanitizeMessages(payload);
  const latest = messages[messages.length - 1];

  if (!messages.length || !latest || latest.role !== "user") {
    return NextResponse.json(
      { error: "A user message is required to start a chat." },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const userId = getSessionUserId(cookieStore);
    const settings = userId
      ? await getUserModelSettingsCached(userId)
      : null;

    if (!settings) {
      return NextResponse.json(
        { error: "Model settings are not configured for this user." },
        { status: 400 }
      );
    }

    const retrievalResults = await searchLibraryChunks(latest.content, {
      limit: 10,
    });
    const results = await rerankChunks(latest.content, retrievalResults, {
      limit: 3,
    });
    const relevantResults = filterRelevantChunks(results);

    let answer:
      | Awaited<ReturnType<typeof generateChatAnswerFromChunks>>
      | Awaited<ReturnType<typeof generateDirectAnswer>>
      | null = null;
    let answerError: string | undefined;

    try {
      if (relevantResults.length > 0) {
        answer = await generateChatAnswerFromChunks(messages, relevantResults, {
          settings,
        });
      } else {
        answer = await generateDirectAnswer(latest.content, { settings });
      }
    } catch (error) {
      console.error("Failed to generate chat answer", error);
      answerError =
        error instanceof Error
          ? error.message
          : "Failed to generate answer using the configured model.";
    }

    return NextResponse.json({
      results: relevantResults,
      answer,
      answerError: answerError ?? null,
    });
  } catch (error) {
    console.error("Failed to process chat request", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process the chat request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
