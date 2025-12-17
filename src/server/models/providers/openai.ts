import type { GenerationRequest, GenerationResult } from "../types";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

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
  const apiKey = request.settings?.apiKey?.trim();
  if (!apiKey) {
    throw new Error("API key is not configured for the selected model.");
  }

  const model =
    request.settings?.modelName?.trim() ||
    request.settings?.ollamaModel?.trim() ||
    DEFAULT_OPENAI_MODEL;

  if (!model) {
    throw new Error("Model name is not configured for the selected provider.");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
    model,
  };
};
