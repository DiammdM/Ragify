import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdmin, UserRole } from "@/lib/auth/user";

const ROLES: UserRole[] = ["user", "admin"];
const ROLE_SET = new Set<UserRole>(ROLES);

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminCheck = await ensureAdmin(request.cookies);
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: adminCheck.status }
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      role: ROLE_SET.has(user.role as UserRole) ? user.role : "user",
    })),
  });
}

export async function POST(request: NextRequest) {
  const adminCheck = await ensureAdmin(request.cookies);
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: adminCheck.status }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { userId?: unknown }).userId !== "string" ||
    typeof (payload as { role?: unknown }).role !== "string"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const userId = (payload as { userId: string }).userId;
  const role = (payload as { role: string }).role;

  if (!ROLE_SET.has(role as UserRole)) {
    return NextResponse.json({ error: "Unsupported role" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Failed to update user role", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
