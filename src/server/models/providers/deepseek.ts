import type { GenerationRequest, GenerationResult } from "../types";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

const toDeepSeekMessages = (request: GenerationRequest) =>
  request.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const resolveDeepSeekModel = (request: GenerationRequest) => {
  const configured =
    request.settings?.modelName?.trim() ||
    request.settings?.ollamaModel?.trim() ||
    "";

  if (configured && configured !== "deepseek") {
    return configured;
  }

  return DEFAULT_MODEL;
};

const normalizeDeepSeekError = async (response: Response) => {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
};

export const callDeepSeek = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  const apiKey = request.settings?.apiKey?.trim();
  if (!apiKey) {
    throw new Error("API key is not configured for the selected model.");
  }

  const model = resolveDeepSeekModel(request);

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: toDeepSeekMessages(request),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 512,
    }),
  });

  if (!response.ok) {
    const reason = await normalizeDeepSeekError(response);
    throw new Error(
      `DeepSeek request failed with status ${response.status}: ${reason}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim();

  if (!text) {
    throw new Error("DeepSeek response did not include any text.");
  }

  return {
    text,
    provider: "deepseek",
    model,
  };
};
