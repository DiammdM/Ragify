import { NextResponse } from "next/server";
import { searchLibraryChunks } from "@/server/library/search";
import { rerankChunks } from "@/server/rerank/cross-encoder";

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
    const retrievalResults = await searchLibraryChunks(question, { limit: 10 });
    const results = await rerankChunks(question, retrievalResults, {
      limit: 3,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to search library chunks", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to search the knowledge base.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
