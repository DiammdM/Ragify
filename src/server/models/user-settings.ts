import { prisma } from "@/lib/prisma";
import type { UserModelSettings } from "@prisma/client";

type CachedEntry = {
  value: UserModelSettings | null;
  expiresAt: number;
};

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const cache = new Map<string, CachedEntry>();

const setCache = (userId: string, value: UserModelSettings | null) => {
  cache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const getUserModelSettingsCached = async (userId: string) => {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await prisma.userModelSettings.findUnique({
    where: { userId },
  });

  setCache(userId, value);
  return value;
};

export const primeUserModelSettingsCache = (
  userId: string,
  value: UserModelSettings | null
) => {
  setCache(userId, value);
};
