import { NextRequest, NextResponse } from "next/server";
import { deleteConversationForUser } from "@/server/chat/history";
import { getUserFromCookies } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromCookies(request.cookies);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteConversationForUser(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat conversation", error);
    return NextResponse.json(
      { error: "Failed to delete conversation." },
      { status: 500 },
    );
  }
}
