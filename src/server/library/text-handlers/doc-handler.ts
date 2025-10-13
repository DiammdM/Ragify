import type { TextExtractionHandler } from "./types";

type WordExtractorModule = typeof import("word-extractor");

const SUPPORTED_EXTENSIONS = new Set(["doc"]);

let wordExtractorModulePromise: Promise<WordExtractorModule> | null = null;

const getWordExtractor = async () => {
  if (!wordExtractorModulePromise) {
    wordExtractorModulePromise = import("word-extractor").catch((error) => {
      console.error("Failed to load word-extractor", error);
      throw new Error(
        "Missing word-extractor dependency. Run `npm install word-extractor` first."
      );
    });
  }
  const pkg = await wordExtractorModulePromise;
  const Extractor =
    pkg.default ?? (pkg as unknown as { WordExtractor: unknown }).WordExtractor;
  if (!Extractor) {
    throw new Error("Failed to load the word-extractor module.");
  }
  return new (Extractor as new () => {
    extract: (filePath: string) => Promise<{ getBody: () => string }>;
  })();
};

export const docHandler: TextExtractionHandler = {
  id: "doc",
  supportedExtensions: SUPPORTED_EXTENSIONS,
  async extract(filePath) {
    const extractor = await getWordExtractor();
    const document = await extractor.extract(filePath);
    return document.getBody();
  },
};
