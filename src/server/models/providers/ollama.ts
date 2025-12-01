import type { GenerationRequest, GenerationResult } from "../types";

const resolveOllamaBaseUrl = (request: GenerationRequest) => {
  const host = request.settings?.ollamaHost?.trim();
  const port = request.settings?.ollamaPort?.trim();

  if (!host) {
    throw new Error("Ollama host is not configured.");
  }

  const normalizedHost =
    host.startsWith("http://") || host.startsWith("https://")
      ? host
      : `http://${host}`;

  const url = new URL(normalizedHost);
  if (port) {
    url.port = port;
  }
  return url.toString().replace(/\/+$/, "");
};

const resolveOllamaModel = (request: GenerationRequest) => {
  const model = request.settings?.ollamaModel?.trim();
  if (!model) {
    throw new Error("Ollama model is not configured.");
  }
  return model;
};

const joinMessages = (request: GenerationRequest) =>
  request.messages
    .map((message) => {
      const prefix =
        message.role === "system"
          ? "System"
          : message.role === "assistant"
            ? "Assistant"
            : "User";
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
  if (!request.settings) {
    throw new Error("Model settings are required for Ollama requests.");
  }

  const baseUrl = resolveOllamaBaseUrl(request);
  const model = resolveOllamaModel(request);
  const prompt = joinMessages(request);
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      think: false,
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
    model,
  };
};
