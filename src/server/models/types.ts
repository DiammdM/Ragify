export type ModelProvider = "openai" | "ollama";

export type GenerationMessageRole = "system" | "user" | "assistant";

export type GenerationMessage = {
  role: GenerationMessageRole;
  content: string;
};

export type ModelSettings = {
  modelKey: string | null;
  apiKey?: string | null;
  chunkSize?: number | null;
  ollamaHost?: string | null;
  ollamaPort?: string | null;
  ollamaModel?: string | null;
};

export type GenerationRequest = {
  messages: GenerationMessage[];
  temperature?: number;
  maxTokens?: number;
  settings?: ModelSettings | null;
};

export type GenerationResult = {
  text: string;
  provider: ModelProvider;
  model: string;
};
