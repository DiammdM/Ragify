import type { GenerationRequest, GenerationResult, ModelProvider } from "./types";
import { callOpenAI } from "./providers/openai";
import { callOllama } from "./providers/ollama";

const DEFAULT_PROVIDER: ModelProvider = "openai";

const resolveProvider = () => {
  const value =
    process.env.ANSWER_MODEL_PROVIDER ??
    process.env.GENERATION_PROVIDER ??
    process.env.LLM_PROVIDER;

  if (value === "ollama") {
    return "ollama";
  }

  return DEFAULT_PROVIDER;
};

export const generateWithModel = async (
  request: GenerationRequest
): Promise<GenerationResult> => {
  const provider = resolveProvider();

  if (provider === "ollama") {
    return callOllama(request);
  }

  return callOpenAI(request);
};
