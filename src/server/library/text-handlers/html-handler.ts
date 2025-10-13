import { readFile } from "fs/promises";
import type { TextExtractionHandler } from "./types";

type HtmlToTextModule = typeof import("html-to-text");

const SUPPORTED_EXTENSIONS = new Set(["html", "htm", "mhtml"]);

let htmlToTextModulePromise: Promise<HtmlToTextModule> | null = null;

const getHtmlToText = async () => {
  if (!htmlToTextModulePromise) {
    htmlToTextModulePromise = import("html-to-text").catch((error) => {
      console.error("Failed to load html-to-text", error);
      throw new Error(
        "Missing html-to-text dependency. Run `npm install html-to-text` first."
      );
    });
  }
  return htmlToTextModulePromise;
};

export const htmlHandler: TextExtractionHandler = {
  id: "html",
  supportedExtensions: SUPPORTED_EXTENSIONS,
  async extract(filePath) {
    const content = await readFile(filePath, "utf8");
    const { htmlToText } = await getHtmlToText();
    return htmlToText(content, {
      wordwrap: false,
      selectors: [{ selector: "a", options: { ignoreHref: true } }],
    });
  },
};
