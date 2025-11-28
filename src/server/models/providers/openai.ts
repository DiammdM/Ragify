import type { GenerationRequest, GenerationResult } from "../types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") ?? "https://api.openai.com/v1";
const OPENAI_MODEL =
  process.env.OPENAI_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const toOpenAIMessages = (request: GenerationRequest) =>
  request.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const normalizeOpenAIError = async (response: Response) => {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
};

export const callOpenAI = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set it in the environment to enable answer generation."
    );
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: toOpenAIMessages(request),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 512,
    }),
  });

  if (!response.ok) {
    const reason = await normalizeOpenAIError(response);
    throw new Error(
      `OpenAI request failed with status ${response.status}: ${reason}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim();

  if (!text) {
    throw new Error("OpenAI response did not include any text.");
  }

  return {
    text,
    provider: "openai",
    model: OPENAI_MODEL,
  };
};
