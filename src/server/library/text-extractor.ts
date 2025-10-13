import path from "path";
import { getHandlerForExtension } from "./text-handlers";

const normalizeWhitespace = (input: string) =>
  input
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .trim();

export async function extractTextContent(filePath: string): Promise<string> {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  if (!extension) {
    throw new Error("Unrecognized file format.");
  }

  const handler = getHandlerForExtension(extension);
  if (!handler) {
    throw new Error(`Unsupported file type: ${extension}`);
  }

  return handler.extract(filePath);
}

export function sanitizeContent(content: string) {
  return normalizeWhitespace(content);
}
