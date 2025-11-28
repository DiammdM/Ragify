export type ModelProvider = "openai" | "ollama";

export type GenerationMessageRole = "system" | "user";

export type GenerationMessage = {
  role: GenerationMessageRole;
  content: string;
};

export type GenerationRequest = {
  messages: GenerationMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type GenerationResult = {
  text: string;
  provider: ModelProvider;
  model: string;
};
