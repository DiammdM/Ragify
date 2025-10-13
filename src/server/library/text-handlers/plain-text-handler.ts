import { readFile } from "fs/promises";
import type { TextExtractionHandler } from "./types";

const SUPPORTED_EXTENSIONS = new Set([
  "txt",
  "md",
  "mdx",
  "markdown",
  "json",
  "yaml",
  "yml",
  "ini",
  "toml",
  "js",
  "jsx",
  "ts",
  "tsx",
  "c",
  "cpp",
  "cc",
  "h",
  "hpp",
  "java",
  "py",
  "rb",
  "php",
  "go",
  "rs",
  "swift",
  "kt",
  "kts",
  "scala",
  "cs",
  "sql",
  "sh",
  "bash",
  "zsh",
  "env",
  "log",
]);

export const plainTextHandler: TextExtractionHandler = {
  id: "plain-text",
  supportedExtensions: SUPPORTED_EXTENSIONS,
  async extract(filePath) {
    return readFile(filePath, "utf8");
  },
};
