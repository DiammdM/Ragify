import type { GenerationRequest, GenerationResult } from "../types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

type GeminiPart = { text: string };
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };

const buildGeminiPayload = (request: GenerationRequest) => {
  const systemMessages = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  const nonSystem = request.messages.filter(
    (message) => message.role !== "system"
  );

  const contents: GeminiContent[] = nonSystem.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxTokens ?? 512,
    },
  };

  if (systemMessages.length) {
    payload.systemInstruction = {
      parts: [{ text: systemMessages.join("\n\n") }],
    };
  }

  return payload;
};

const normalizeGeminiError = async (response: Response) => {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
};

export const callGemini = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  const apiKey = request.settings?.apiKey?.trim();
  if (!apiKey) {
    throw new Error("API key is not configured for the selected model.");
  }

  const model =
    request.settings?.modelName?.trim() ||
    request.settings?.ollamaModel?.trim() ||
    DEFAULT_GEMINI_MODEL;

  if (!model) {
    throw new Error("Model name is not configured for the selected provider.");
  }

  const payload = buildGeminiPayload(request);
  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const reason = await normalizeGeminiError(response);
    throw new Error(
      `Gemini request failed with status ${response.status}: ${reason}`
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim())
      .filter(Boolean)
      .join("\n")
      ?.trim();

  if (!text) {
    throw new Error("Gemini response did not include any text.");
  }

  return {
    text,
    provider: "gemini",
    model,
  };
};
