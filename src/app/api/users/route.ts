import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password =
    typeof body?.password === "string" ? body.password : "password123";

  if (!name || password.length < 6) {
    return NextResponse.json(
      { error: "Name and password are required." },
      { status: 400 }
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      password: hashPassword(password),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(user);
}
