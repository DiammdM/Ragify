import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "./session";

export type UserRole = "user" | "admin";

const ROLE_SET = new Set<UserRole>(["user", "admin"]);

const normalizeRole = (role: string | null | undefined): UserRole =>
  ROLE_SET.has(role as UserRole) ? (role as UserRole) : "user";

export const getUserFromCookies = async (
  cookies: { get: (key: string) => { value?: string } | undefined }
) => {
  const userId = getSessionUserId(cookies);
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, createdAt: true },
  });

  if (!user) {
    return null;
  }

  return {
    ...user,
    role: normalizeRole(user.role),
  };
};

export const ensureAdmin = async (
  cookies: { get: (key: string) => { value?: string } | undefined }
) => {
  const user = await getUserFromCookies(cookies);
  if (!user) {
    return { ok: false, status: 401 as const };
  }
  if (user.role !== "admin") {
    return { ok: false, status: 403 as const };
  }
  return { ok: true as const, user };
};
