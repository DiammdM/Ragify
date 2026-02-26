import { searchLibraryChunks } from "@/server/library/search";
import { generateWithModel } from "@/server/models/client";
import type { ModelSettings } from "@/server/models/types";

type PlannerAction = "search_docs" | "final_answer";

type PlannerDecision = {
  thought: string;
  action: PlannerAction;
  input: string;
};

export type AgentTraceStep = {
  turn: number;
  thought: string;
  action: PlannerAction;
  actionInput: string;
  observation: string;
};

export type SimpleAgentResult = {
  answer: string;
  trace: AgentTraceStep[];
};

type RunSimpleAgentOptions = {
  settings?: ModelSettings | null;
  maxTurns?: number;
};

const DEFAULT_MAX_TURNS = 4;

const clampTurns = (maxTurns?: number) => {
  if (typeof maxTurns !== "number" || !Number.isFinite(maxTurns)) {
    return DEFAULT_MAX_TURNS;
  }

  const integer = Math.floor(maxTurns);
  return Math.min(Math.max(integer, 1), 8);
};

const stripCodeFence = (value: string) => {
  const fenceMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch?.[1]?.trim() ?? value.trim();
};

const extractJsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return raw.slice(start, end + 1);
};

const parsePlannerDecision = (raw: string): PlannerDecision | null => {
  const normalized = stripCodeFence(raw);
  const candidate = extractJsonObject(normalized) ?? normalized;

  try {
    const parsed = JSON.parse(candidate) as Partial<PlannerDecision>;
    const thought =
      typeof parsed.thought === "string" ? parsed.thought.trim() : "";
    const action = parsed.action;
    const input = typeof parsed.input === "string" ? parsed.input.trim() : "";

    if (
      !thought ||
      (action !== "search_docs" && action !== "final_answer") ||
      !input
    ) {
      return null;
    }

    return { thought, action, input };
  } catch {
    return null;
  }
};

const serializeTrace = (trace: AgentTraceStep[]) => {
  if (!trace.length) {
    return "No previous steps.";
  }

  return trace
    .map((step) => {
      return [
        `Turn ${step.turn}`,
        `Thought: ${step.thought}`,
        `Action: ${step.action}`,
        `Input: ${step.actionInput}`,
        `Observation: ${step.observation}`,
      ].join("\n");
    })
    .join("\n\n");
};

const buildPlannerMessages = (goal: string, trace: AgentTraceStep[]) => {
  const system = [
    "You are a task agent.",
    "You can use two actions only:",
    "1) search_docs: search knowledge chunks by query.",
    "2) final_answer: produce final answer for the user.",
    "",
    "Rules:",
    "- Reply with JSON only.",
    '- JSON schema: {"thought":"...","action":"search_docs|final_answer","input":"..."}',
    "- Keep thought short and concrete.",
    "- Use search_docs when evidence is missing.",
    "- Use final_answer when the answer is ready.",
  ].join("\n");

  const user = [
    `Goal: ${goal}`,
    "",
    "Previous steps:",
    serializeTrace(trace),
    "",
    "Return next action JSON now.",
  ].join("\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
};

const toSingleLine = (value: string) => value.replace(/\s+/g, " ").trim();

const runSearchDocsTool = async (query: string) => {
  try {
    const chunks = await searchLibraryChunks(query, { limit: 3 });

    if (!chunks.length) {
      return "No related chunks found in library.";
    }

    return chunks
      .map((chunk, index) => {
        const title = chunk.documentName?.trim() || "Untitled";
        const snippet = toSingleLine(chunk.content).slice(0, 180);
        return `[S${index + 1}] ${title} | ${snippet}`;
      })
      .join("\n");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown search error.";
    return `search_docs failed: ${message}`;
  }
};

const buildFallbackMessages = (goal: string, trace: AgentTraceStep[]) => {
  const system =
    "You are a helpful assistant. Write a final answer based on available observations. " +
    "If observations are weak, be transparent and provide best-effort guidance.";

  const user = [
    `Goal: ${goal}`,
    "",
    "Agent trace:",
    serializeTrace(trace),
    "",
    "Now provide the final answer directly.",
  ].join("\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
};

export const runSimpleAgent = async (
  goal: string,
  options?: RunSimpleAgentOptions
): Promise<SimpleAgentResult> => {
  const trimmedGoal = goal.trim();
  if (!trimmedGoal) {
    throw new Error("Goal is required.");
  }

  const maxTurns = clampTurns(options?.maxTurns);
  const trace: AgentTraceStep[] = [];
  let answer = "";

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const planner = await generateWithModel({
      messages: buildPlannerMessages(trimmedGoal, trace),
      temperature: 0,
      maxTokens: 220,
      settings: options?.settings ?? undefined,
    });
    const decision = parsePlannerDecision(planner.text);

    if (!decision) {
      trace.push({
        turn,
        thought: "Planner output was not valid JSON.",
        action: "search_docs",
        actionInput: trimmedGoal,
        observation:
          "Invalid planner output. Retrying with search_docs using the goal text.",
      });
      continue;
    }

    if (decision.action === "final_answer") {
      answer = decision.input;
      trace.push({
        turn,
        thought: decision.thought,
        action: decision.action,
        actionInput: decision.input,
        observation: "Agent finished with final_answer.",
      });
      break;
    }

    const observation = await runSearchDocsTool(decision.input);
    trace.push({
      turn,
      thought: decision.thought,
      action: decision.action,
      actionInput: decision.input,
      observation,
    });
  }

  if (!answer) {
    const fallback = await generateWithModel({
      messages: buildFallbackMessages(trimmedGoal, trace),
      temperature: 0.2,
      maxTokens: 512,
      settings: options?.settings ?? undefined,
    });
    answer = fallback.text.trim();
  }

  return { answer, trace };
};
