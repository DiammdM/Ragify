import type { RetrievedChunk } from "../library/search";
import { generateWithModel } from "../models/client";
import type { GenerationMessage } from "../models/types";

export type AnswerPayload = {
  text: string;
  provider: string;
  model: string;
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
  chunks: RetrievedChunk[]
): Promise<AnswerPayload> => {
  if (!chunks.length) {
    throw new Error("No sources available to generate an answer.");
  }

  const messages = buildMessages(question, chunks);
  const result = await generateWithModel({
    messages,
    temperature: 0.2,
    maxTokens: 512,
  });

  return {
    text: result.text.trim(),
    provider: result.provider,
    model: result.model,
  };
};
