import { NextResponse } from "next/server";
import { runSimpleAgent } from "@/server/agent/simple-agent";
import { getModelSettingsCached } from "@/server/models/user-settings";

export const runtime = "nodejs";

type AgentDemoRequest = {
  task?: unknown;
  maxTurns?: unknown;
};

const toMaxTurns = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
};

export async function POST(request: Request) {
  let payload: AgentDemoRequest;

  try {
    payload = (await request.json()) as AgentDemoRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const task = typeof payload.task === "string" ? payload.task.trim() : "";
  if (!task) {
    return NextResponse.json(
      { error: "task is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  try {
    const settings = await getModelSettingsCached();
    if (!settings) {
      return NextResponse.json(
        { error: "Model settings are not configured for this user." },
        { status: 400 }
      );
    }

    const result = await runSimpleAgent(task, {
      settings,
      maxTurns: toMaxTurns(payload.maxTurns),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to run demo agent", error);
    const message =
      error instanceof Error ? error.message : "Failed to run demo agent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
