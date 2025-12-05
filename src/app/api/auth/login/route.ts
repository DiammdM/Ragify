import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { attachSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

const sanitize = (value: string) => value.trim();

const parsePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload" } as const;
  }

  const name =
    typeof (payload as { name?: unknown }).name === "string"
      ? sanitize((payload as { name: string }).name)
      : "";
  const password =
    typeof (payload as { password?: unknown }).password === "string"
      ? (payload as { password: string }).password
      : "";

  if (!name || !password) {
    return { error: "Name and password are required." } as const;
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

  const parsed = parsePayload(payload);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { name: parsed.name },
  });

  if (!user || !verifyPassword(parsed.password, user.password)) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role ?? "user",
    },
  });

  attachSessionCookie(response, user.id);

  return response;
}
