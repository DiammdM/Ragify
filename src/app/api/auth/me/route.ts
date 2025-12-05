import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getUserFromCookies(request.cookies);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
}
