import { readFile } from "fs/promises";
import type { TextExtractionHandler } from "./types";

type MammothModule = typeof import("mammoth");

const SUPPORTED_EXTENSIONS = new Set(["docx"]);

let mammothModulePromise: Promise<MammothModule> | null = null;

const getMammoth = async () => {
  if (!mammothModulePromise) {
    mammothModulePromise = import("mammoth").catch((error) => {
      console.error("Failed to load mammoth", error);
      throw new Error(
        "Missing mammoth dependency. Run `npm install mammoth` first."
      );
    });
  }
  const mod = await mammothModulePromise;
  const api = (mod as unknown as { default?: MammothModule }).default ?? mod;

  if (!api || typeof (api as MammothModule).extractRawText !== "function") {
    throw new Error("The mammoth module has an invalid format.");
  }

  return api as MammothModule;
};

export const docxHandler: TextExtractionHandler = {
  id: "docx",
  supportedExtensions: SUPPORTED_EXTENSIONS,
  async extract(filePath) {
    const buffer = await readFile(filePath);
    const mammoth = await getMammoth();
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  },
};
