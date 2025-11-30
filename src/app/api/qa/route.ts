import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { searchLibraryChunks } from "@/server/library/search";
import { rerankChunks } from "@/server/rerank/cross-encoder";
import { generateAnswerFromChunks } from "@/server/answers/generator";
import { getSessionUserId } from "@/lib/auth/session";
import { getUserModelSettingsCached } from "@/server/models/user-settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question =
    payload &&
    typeof payload === "object" &&
    "question" in payload &&
    typeof (payload as { question: unknown }).question === "string"
      ? (payload as { question: string }).question.trim()
      : "";

  if (!question) {
    return NextResponse.json(
      { error: "Question text is required." },
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

    const retrievalResults = await searchLibraryChunks(question, { limit: 10 });
    const results = await rerankChunks(question, retrievalResults, {
      limit: 3,
    });

    let answer: Awaited<ReturnType<typeof generateAnswerFromChunks>> | null = null;
    let answerError: string | undefined;

    try {
      answer = await generateAnswerFromChunks(question, results, {
        settings,
      });
    } catch (error) {
      console.error("Failed to generate answer", error);
      answerError =
        error instanceof Error
          ? error.message
          : "Failed to generate answer using the configured model.";
    }

    return NextResponse.json({ results, answer, answerError: answerError ?? null });
  } catch (error) {
    console.error("Failed to search library chunks", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to search the knowledge base.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
