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
      throw new Error("缺少 pdf-parse 依赖，请先运行 npm install pdf-parse");
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
    throw new Error("pdf-parse 模块格式不正确");
  }

  return parser;
};

const getMammoth = async () => {
  if (!mammothModulePromise) {
    mammothModulePromise = import("mammoth").catch((error) => {
      console.error("Failed to load mammoth", error);
      throw new Error("缺少 mammoth 依赖，请先运行 npm install mammoth");
    });
  }
  const mod = await mammothModulePromise;
  const api = (mod as unknown as { default?: MammothModule }).default ?? mod;

  if (!api || typeof (api as MammothModule).extractRawText !== "function") {
    throw new Error("mammoth 模块格式不正确");
  }

  return api as MammothModule;
};

const getHtmlToText = async () => {
  if (!htmlToTextModulePromise) {
    htmlToTextModulePromise = import("html-to-text").catch((error) => {
      console.error("Failed to load html-to-text", error);
      throw new Error(
        "缺少 html-to-text 依赖，请先运行 npm install html-to-text"
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
        "缺少 word-extractor 依赖，请先运行 npm install word-extractor"
      );
    });
  }
  const pkg = await wordExtractorModulePromise;
  const Extractor =
    pkg.default ?? (pkg as unknown as { WordExtractor: unknown }).WordExtractor;
  if (!Extractor) {
    throw new Error("word-extractor 模块加载失败");
  }
  return new (Extractor as new () => {
    extract: (filePath: string) => Promise<{ getBody: () => string }>;
  })();
};

const getXlsx = async () => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx").catch((error) => {
      console.error("Failed to load xlsx", error);
      throw new Error("缺少 xlsx 依赖，请先运行 npm install xlsx");
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
    throw new Error("无法识别的文件格式");
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

  throw new Error(`暂不支持的文件类型: ${extension}`);
}

export function sanitizeContent(content: string) {
  return normalizeWhitespace(content);
}
