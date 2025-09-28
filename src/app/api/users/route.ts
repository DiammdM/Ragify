import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();

  const user = await prisma.user.create({
    data: {
      name: body.name ?? "Alice",
      email: body.email ?? "alice@example.com",
    },
  });

  return NextResponse.json(user);
}
