import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_SIZE = 16;
const KEY_LENGTH = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(SALT_SIZE).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const hashBuffer = Buffer.from(hash, "hex");

  if (hashBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(hashBuffer, derivedKey);
};
