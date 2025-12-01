import type { RetrievedChunk } from "../library/search";
import { generateWithModel } from "../models/client";
import type { GenerationMessage, ModelSettings } from "../models/types";

export type AnswerPayload = {
  text: string;
  provider: string;
  model: string;
};

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const buildSourceBlock = (chunk: RetrievedChunk, index: number) => {
  const title = chunk.documentName ?? `Source ${index + 1}`;
  const content = chunk.content?.trim() || "No content available.";

  return [
    `Source ${index + 1}: ${title}`,
    `Chunk ID: ${chunk.id}`,
    content,
  ].join("\n");
};

const buildMessages = (question: string, chunks: RetrievedChunk[]): GenerationMessage[] => {
  const sources = chunks
    .map((chunk, index) => buildSourceBlock(chunk, index))
    .join("\n\n");

  const system =
    "You are a retrieval-augmented assistant. Use ONLY the provided sources to answer the user's question. " +
    "Cite sources using [S1], [S2], etc. If the answer is not in the sources, say you don't know.";

  const user = [
    `Question: ${question.trim()}`,
    "",
    "Sources:",
    sources,
    "",
    "Answer:",
  ]
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
};

export const generateAnswerFromChunks = async (
  question: string,
  chunks: RetrievedChunk[],
  options?: { settings?: ModelSettings | null }
): Promise<AnswerPayload> => {
  if (!chunks.length) {
    throw new Error("No sources available to generate an answer.");
  }

  const messages = buildMessages(question, chunks);
  const result = await generateWithModel({
    messages,
    temperature: 0.2,
    maxTokens: 512,
    settings: options?.settings ?? undefined,
  });

  return {
    text: result.text.trim(),
    provider: result.provider,
    model: result.model,
  };
};

export const generateDirectAnswer = async (
  question: string,
  options?: { settings?: ModelSettings | null }
): Promise<AnswerPayload> => {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question text is required to generate an answer.");
  }

  const messages: GenerationMessage[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant. Answer concisely and accurately. If you are unsure, say so briefly.",
    },
    { role: "user", content: trimmed },
  ];

  const result = await generateWithModel({
    messages,
    temperature: 0.5,
    maxTokens: 512,
    settings: options?.settings ?? undefined,
  });

  return {
    text: result.text.trim(),
    provider: result.provider,
    model: result.model,
  };
};

const buildChatMessages = (
  history: ConversationTurn[],
  chunks: RetrievedChunk[]
): GenerationMessage[] => {
  const sources = chunks
    .map((chunk, index) => buildSourceBlock(chunk, index))
    .join("\n\n");

  const system =
    "You are a retrieval-augmented assistant. Use ONLY the provided sources to answer the user's question. " +
    "Cite sources using [S1], [S2], etc. If the answer is not in the sources, say you don't know. Keep replies concise.";

  const trimmedHistory = history
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-8);

  const latestUser = trimmedHistory[trimmedHistory.length - 1];
  if (!latestUser || latestUser.role !== "user") {
    throw new Error("The latest message must be from the user.");
  }

  const priorMessages = trimmedHistory.slice(0, -1);
  const userContent = [
    latestUser.content,
    "",
    "Use only the sources below to answer.",
    "Sources:",
    sources,
    "",
    "Answer:",
  ].join("\n");

  return [
    { role: "system", content: system },
    ...priorMessages,
    { role: "user", content: userContent },
  ];
};

export const generateChatAnswerFromChunks = async (
  history: ConversationTurn[],
  chunks: RetrievedChunk[],
  options?: { settings?: ModelSettings | null }
): Promise<AnswerPayload> => {
  if (!chunks.length) {
    throw new Error("No sources available to generate an answer.");
  }

  const messages = buildChatMessages(history, chunks);
  const result = await generateWithModel({
    messages,
    temperature: 0.2,
    maxTokens: 640,
    settings: options?.settings ?? undefined,
  });

  return {
    text: result.text.trim(),
    provider: result.provider,
    model: result.model,
  };
};
