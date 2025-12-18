import type {
  GenerationRequest,
  GenerationResult,
  ModelProvider,
} from "./types";
import { callOpenAI } from "./providers/openai";
import { callOllama } from "./providers/ollama";
import { callDeepSeek } from "./providers/deepseek";
import { callGemini } from "./providers/gemini";

const resolveProvider = (request: GenerationRequest): ModelProvider => {
  if (!request.settings) {
    throw new Error("Model settings are required to choose a provider.");
  }

  const key = request.settings.modelKey?.trim();
  if (!key) {
    throw new Error("Model key is required to choose a provider.");
  }

  if (key === "ollama") return "ollama";
  if (key === "gemini") return "gemini";
  if (key === "deepseek") return "deepseek";

  return "openai";
};

export const generateWithModel = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  const provider = resolveProvider(request);

  if (provider === "ollama") {
    return callOllama(request);
  }

  if (provider === "deepseek") {
    return callDeepSeek(request);
  }

  if (provider === "gemini") {
    return callGemini(request);
  }

  return callOpenAI(request);
};
