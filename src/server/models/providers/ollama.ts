import type { GenerationRequest, GenerationResult } from "../types";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";

const joinMessages = (request: GenerationRequest) =>
  request.messages
    .map((message) => {
      const prefix = message.role === "system" ? "System" : "User";
      return `${prefix}:\n${message.content.trim()}`;
    })
    .join("\n\n");

const normalizeOllamaError = async (response: Response) => {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "Request failed";
  } catch {
    return response.statusText || "Request failed";
  }
};

export const callOllama = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  const prompt = joinMessages(request);
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.2,
        num_predict: request.maxTokens ?? 512,
      },
    }),
  });

  if (!response.ok) {
    const reason = await normalizeOllamaError(response);
    throw new Error(
      `Ollama request failed with status ${response.status}: ${reason}`
    );
  }

  const payload = (await response.json()) as { response?: string };
  const text = payload.response?.trim();
  if (!text) {
    throw new Error("Ollama did not return any content.");
  }

  return {
    text,
    provider: "ollama",
    model: OLLAMA_MODEL,
  };
};
