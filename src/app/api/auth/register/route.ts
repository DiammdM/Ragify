import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { attachSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

const sanitizeName = (value: string) => value.trim();

const validatePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload" } as const;
  }

  const name =
    typeof (payload as { name?: unknown }).name === "string"
      ? sanitizeName((payload as { name: string }).name)
      : "";
  const password =
    typeof (payload as { password?: unknown }).password === "string"
      ? (payload as { password: string }).password
      : "";

  if (name.length < 3) {
    return { error: "Name must be at least 3 characters long." } as const;
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long." } as const;
  }

  return { name, password } as const;
};

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validatePayload(payload);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { name: parsed.name },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This username is already taken." },
      { status: 409 }
    );
  }

  const hashed = hashPassword(parsed.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      password: hashed,
      role: "user",
    },
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role ?? "user",
      createdAt: user.createdAt,
    },
  });

  attachSessionCookie(response, user.id);

  return response;
}
