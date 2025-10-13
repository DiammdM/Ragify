import { readFile } from "fs/promises";
import { createRequire } from "module";
import type { TextExtractionHandler } from "./types";

type PdfParser = (data: Buffer) => Promise<{ text: string }>;

const SUPPORTED_EXTENSIONS = new Set(["pdf"]);

const require = createRequire(import.meta.url);

let pdfParserPromise: Promise<PdfParser> | null = null;

const getPdfParser = async (): Promise<PdfParser> => {
  if (!pdfParserPromise) {
    pdfParserPromise = (async () => {
      try {
        const loaded = require("pdf-parse/lib/pdf-parse.js");
        const parser =
          (loaded as { default?: PdfParser }).default ?? (loaded as PdfParser);
        if (typeof parser === "function") {
          return parser;
        }
      } catch (error) {
        console.error("Failed to load pdf-parse", error);
      }

      throw new Error(
        "Missing pdf-parse dependency. Run `npm install pdf-parse` first."
      );
    })();
  }
  return pdfParserPromise;
};

export const pdfHandler: TextExtractionHandler = {
  id: "pdf",
  supportedExtensions: SUPPORTED_EXTENSIONS,
  async extract(filePath) {
    const buffer = await readFile(filePath);
    const parser = await getPdfParser();
    const { text } = await parser(buffer);
    return text;
  },
};
