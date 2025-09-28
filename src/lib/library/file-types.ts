const extensions = [
  // PDF
  "pdf",
  // Word / Markdown
  "doc",
  "docx",
  "md",
  "mdx",
  "markdown",
  "rtf",
  // Wiki / HTML exports
  "html",
  "htm",
  "mhtml",
  // Tables / spreadsheets
  "csv",
  "tsv",
  "xls",
  "xlsx",
  "ods",
  // Code / text files
  "txt",
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
] as const;

export const ALLOWED_FILE_EXTENSIONS = extensions;

export const ALLOWED_FILE_EXTENSION_SET = new Set(
  ALLOWED_FILE_EXTENSIONS
);

export const ALLOWED_FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.map(
  (ext) => `.${ext}`
).join(",");

export const isAllowedExtension = (extension: string) =>
  ALLOWED_FILE_EXTENSION_SET.has(extension.toLowerCase());
