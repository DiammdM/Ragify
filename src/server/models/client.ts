import type {
  GenerationRequest,
  GenerationResult,
  ModelProvider,
} from "./types";
import { callOpenAI } from "./providers/openai";
import { callOllama } from "./providers/ollama";

const resolveProvider = (request: GenerationRequest): ModelProvider => {
  if (!request.settings) {
    throw new Error("Model settings are required to choose a provider.");
  }

  if (request.settings.modelKey === "ollama") {
    return "ollama";
  }

  return "openai";
};

export const generateWithModel = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  const provider = resolveProvider(request);

  if (provider === "ollama") {
    return callOllama(request);
  }

  return callOpenAI(request);
};
