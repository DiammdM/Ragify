import { NextRequest, NextResponse } from "next/server";
import {
  createConversationForUser,
  listConversationsForUser,
} from "@/server/chat/history";
import { getUserFromCookies } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getUserFromCookies(request.cookies);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await listConversationsForUser(user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Failed to list chat conversations", error);
    return NextResponse.json(
      { error: "Failed to load chat conversations." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromCookies(request.cookies);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversation = await createConversationForUser(user.id);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Failed to create chat conversation", error);
    return NextResponse.json(
      { error: "Failed to create conversation." },
      { status: 500 },
    );
  }
}
