import { NextResponse } from "next/server";

const SESSION_COOKIE = "ragify_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const isProduction = process.env.NODE_ENV === "production";

export const attachSessionCookie = (
  response: NextResponse,
  userId: string
) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: userId,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
};
