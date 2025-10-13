import type { TextExtractionHandler } from "./types";
import { matchesExtension } from "./types";
import { plainTextHandler } from "./plain-text-handler";
import { spreadsheetHandler } from "./spreadsheet-handler";
import { htmlHandler } from "./html-handler";
import { pdfHandler } from "./pdf-handler";
import { docxHandler } from "./docx-handler";
import { docHandler } from "./doc-handler";

const HANDLERS: TextExtractionHandler[] = [
  plainTextHandler,
  spreadsheetHandler,
  htmlHandler,
  pdfHandler,
  docxHandler,
  docHandler,
];

export type { TextExtractionHandler } from "./types";

export function getHandlerForExtension(extension: string) {
  return HANDLERS.find((handler) => matchesExtension(handler, extension));
}

export function getRegisteredHandlers() {
  return HANDLERS.slice();
}
