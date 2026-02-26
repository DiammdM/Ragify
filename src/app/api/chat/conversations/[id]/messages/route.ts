import { NextRequest, NextResponse } from "next/server";
import {
  generateChatAnswerFromChunks,
  generateDirectAnswer,
} from "@/server/answers/generator";
import { searchLibraryChunks } from "@/server/library/search";
import { rerankChunks } from "@/server/rerank/cross-encoder";
import { getModelSettingsCached } from "@/server/models/user-settings";
import { getSourceLabel } from "@/lib/source-label";
import {
  MAX_CONTEXT_TURNS,
  createMessageForConversation,
  deriveConversationTitle,
  getConversationForUser,
  getConversationListItemForUser,
  getMessageCountForConversation,
  getMessagesForConversation,
  getRecentConversationTurns,
} from "@/server/chat/history";
import { getUserFromCookies } from "@/lib/auth/user";

export const runtime = "nodejs";

const MIN_CROSS_SCORE = 0.35;

const sanitizeContent = (payload: unknown) => {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("content" in payload) ||
    typeof (payload as { content: unknown }).content !== "string"
  ) {
    return "";
  }

  return (payload as { content: string }).content.trim();
};

const filterRelevantChunks = (
  chunks: Awaited<ReturnType<typeof rerankChunks>>,
) => chunks.filter((chunk) => (chunk.crossScore ?? 0) >= MIN_CROSS_SCORE);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromCookies(request.cookies);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversationForUser(user.id, id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    const messages = await getMessagesForConversation(conversation.id);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to load chat messages", error);
    return NextResponse.json(
      { error: "Failed to load chat messages." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromCookies(request.cookies);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversationForUser(user.id, id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content = sanitizeContent(payload);
  if (!content) {
    return NextResponse.json(
      { error: "Message content is required." },
      { status: 400 },
    );
  }

  try {
    const messageCount = await getMessageCountForConversation(conversation.id);
    const nextTitle =
      messageCount === 0 ? deriveConversationTitle(content) : undefined;

    const userMessage = await createMessageForConversation({
      conversationId: conversation.id,
      role: "user",
      content,
      updateTitle: nextTitle,
    });

    const history = await getRecentConversationTurns(
      conversation.id,
      MAX_CONTEXT_TURNS,
    );

    let assistantText = "";
    let assistantError: string | null = null;

    try {
      const settings = await getModelSettingsCached();
      if (!settings) {
        throw new Error("Model settings are not configured for this user.");
      }

      let relevantResults: Awaited<ReturnType<typeof rerankChunks>> = [];

      try {
        const retrievalResults = await searchLibraryChunks(content, { limit: 10 });
        const reranked = await rerankChunks(content, retrievalResults, {
          limit: 3,
        });
        relevantResults = filterRelevantChunks(reranked);

        console.info(
          "[chat] relevant chunks",
          relevantResults.map((chunk) => ({
            source: getSourceLabel(chunk),
            chunkIndex: chunk.chunkIndex,
            score: chunk.score,
            crossScore: chunk.crossScore ?? null,
          })),
        );
      } catch (error) {
        console.error("Failed to retrieve relevant chunks for chat", error);
      }

      const answer =
        relevantResults.length > 0
          ? await generateChatAnswerFromChunks(history, relevantResults, {
              settings,
            })
          : await generateDirectAnswer(content, {
              settings,
              history,
            });

      assistantText = answer.text.trim();
    } catch (error) {
      assistantError =
        error instanceof Error
          ? error.message
          : "Failed to generate answer using the configured model.";
      assistantText = assistantError;
      console.error("Failed to generate chat answer", error);
    }

    if (!assistantText) {
      assistantText = "Unable to generate a response right now.";
      assistantError = assistantError ?? assistantText;
    }

    const assistantMessage = await createMessageForConversation({
      conversationId: conversation.id,
      role: "assistant",
      content: assistantText,
    });

    const conversationItem = await getConversationListItemForUser(
      user.id,
      conversation.id,
    );

    if (!conversationItem) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      conversation: conversationItem,
      userMessage,
      assistantMessage,
      assistantError,
    });
  } catch (error) {
    console.error("Failed to send chat message", error);
    return NextResponse.json(
      { error: "Failed to process chat message." },
      { status: 500 },
    );
  }
}
