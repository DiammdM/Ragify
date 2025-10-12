import { readFile } from "fs/promises";
import path from "path";
type PdfParseModule = typeof import("pdf-parse");
type MammothModule = typeof import("mammoth");
type HtmlToTextModule = typeof import("html-to-text");
type WordExtractorModule = typeof import("word-extractor");
type XlsxModule = typeof import("xlsx");

const TEXT_EXTENSIONS = new Set([
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

const MARKDOWN_EXTENSIONS = new Set(["md", "mdx", "markdown"]);
const HTML_EXTENSIONS = new Set(["html", "htm", "mhtml"]);
const SPREADSHEET_EXTENSIONS = new Set(["csv", "tsv", "xls", "xlsx", "ods"]);

let pdfParseModulePromise: Promise<PdfParseModule> | null = null;
let mammothModulePromise: Promise<MammothModule> | null = null;
let htmlToTextModulePromise: Promise<HtmlToTextModule> | null = null;
let wordExtractorModulePromise: Promise<WordExtractorModule> | null = null;
let xlsxModulePromise: Promise<XlsxModule> | null = null;

const getPdfParser = async () => {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = import("pdf-parse").catch((error) => {
      console.error("Failed to load pdf-parse", error);
      throw new Error(
        "Missing pdf-parse dependency. Run `npm install pdf-parse` first."
      );
    });
  }
  const mod = await pdfParseModulePromise;
  const parser =
    (
      mod as unknown as {
        default?: (data: Buffer) => Promise<{ text: string }>;
      }
    ).default ??
    (mod as unknown as (data: Buffer) => Promise<{ text: string }>);

  if (typeof parser !== "function") {
    throw new Error("The pdf-parse module has an invalid format.");
  }

  return parser;
};

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

const getXlsx = async () => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx").catch((error) => {
      console.error("Failed to load xlsx", error);
      throw new Error(
        "Missing xlsx dependency. Run `npm install xlsx` first."
      );
    });
  }
  return xlsxModulePromise;
};

const normalizeWhitespace = (input: string) =>
  input
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .trim();

const readPlainText = async (filePath: string) => {
  const content = await readFile(filePath, "utf8");
  return content;
};

const readSpreadsheet = async (filePath: string) => {
  const XLSX = await getXlsx();
  const workbook = XLSX.readFile(filePath);
  const segments: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
    segments.push(`# Sheet: ${sheetName}\n${csv}`);
  }

  return segments.join("\n\n");
};

const readHtml = async (filePath: string) => {
  const content = await readFile(filePath, "utf8");
  const { htmlToText } = await getHtmlToText();
  return htmlToText(content, {
    wordwrap: false,
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  });
};

const readPdf = async (filePath: string) => {
  const buffer = await readFile(filePath);
  const parser = await getPdfParser();
  const { text } = await parser(buffer);
  return text;
};

const readDocx = async (filePath: string) => {
  const buffer = await readFile(filePath);
  const mammoth = await getMammoth();
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
};

const readDoc = async (filePath: string) => {
  const extractor = await getWordExtractor();
  const document = await extractor.extract(filePath);
  return document.getBody();
};

export async function extractTextContent(filePath: string): Promise<string> {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  if (!extension) {
    throw new Error("Unrecognized file format.");
  }

  if (TEXT_EXTENSIONS.has(extension) || MARKDOWN_EXTENSIONS.has(extension)) {
    return readPlainText(filePath);
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return readSpreadsheet(filePath);
  }

  if (HTML_EXTENSIONS.has(extension)) {
    return readHtml(filePath);
  }

  if (extension === "pdf") {
    return readPdf(filePath);
  }

  if (extension === "docx") {
    return readDocx(filePath);
  }

  if (extension === "doc") {
    return readDoc(filePath);
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

export function sanitizeContent(content: string) {
  return normalizeWhitespace(content);
}
