import { NextResponse } from "next/server";
import { searchLibraryChunks } from "@/server/library/search";
import { rerankChunks } from "@/server/rerank/cross-encoder";
import {
  generateAnswerFromChunks,
  generateDirectAnswer,
} from "@/server/answers/generator";
import { getModelSettingsCached } from "@/server/models/user-settings";

export const runtime = "nodejs";

const MIN_CROSS_SCORE = 0.35;

const filterRelevantChunks = (
  chunks: Awaited<ReturnType<typeof rerankChunks>>
) => chunks.filter((chunk) => (chunk.crossScore ?? 0) >= MIN_CROSS_SCORE);

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
    // TODO  缓存key不是userid了
    const settings = await getModelSettingsCached();

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
    const relevantResults = filterRelevantChunks(results);

    let answer:
      | Awaited<ReturnType<typeof generateAnswerFromChunks>>
      | Awaited<ReturnType<typeof generateDirectAnswer>>
      | null = null;
    let answerError: string | undefined;

    try {
      if (relevantResults.length > 0) {
        answer = await generateAnswerFromChunks(question, relevantResults, {
          settings,
        });
      } else {
        answer = await generateDirectAnswer(question, { settings });
      }
    } catch (error) {
      console.error("Failed to generate answer", error);
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
    console.error("Failed to search library chunks", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to search the knowledge base.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
