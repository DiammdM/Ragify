import { prisma } from "@/lib/prisma";
import type { ModelSettings } from "@prisma/client";

type CachedEntry = {
  value: ModelSettings | null;
  expiresAt: number;
};
const cacheKey = "modelSettings";

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const cache = new Map<string, CachedEntry>();

const setCache = (id: string, value: ModelSettings | null) => {
  cache.set(id, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const getModelSettingsCached = async () => {
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // TODO 需要验证
  const value = await prisma.modelSettings.findFirst();

  setCache(cacheKey, value);
  return value;
};

export const primeModelSettingsCache = (value: ModelSettings | null) => {
  setCache(cacheKey, value);
};
