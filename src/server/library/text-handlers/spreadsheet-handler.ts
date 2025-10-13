import type { TextExtractionHandler } from "./types";

type XlsxModule = typeof import("xlsx");

const SUPPORTED_EXTENSIONS = new Set(["csv", "tsv", "xls", "xlsx", "ods"]);

let xlsxModulePromise: Promise<XlsxModule> | null = null;

const getXlsx = async () => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx").catch((error) => {
      console.error("Failed to load xlsx", error);
      throw new Error("Missing xlsx dependency. Run `npm install xlsx` first.");
    });
  }
  return xlsxModulePromise;
};

export const spreadsheetHandler: TextExtractionHandler = {
  id: "spreadsheet",
  supportedExtensions: SUPPORTED_EXTENSIONS,
  async extract(filePath) {
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
  },
};
