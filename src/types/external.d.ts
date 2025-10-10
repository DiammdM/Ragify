declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

declare module "mammoth" {
  interface MammothResult {
    value: string;
  }
  interface ExtractOptions {
    buffer?: Buffer;
  }
  export function extractRawText(options: ExtractOptions): Promise<MammothResult>;
  const mammoth: {
    extractRawText: typeof extractRawText;
  };
  export default mammoth;
}

declare module "html-to-text" {
  interface Options {
    wordwrap?: boolean;
    selectors?: Array<{ selector: string; options?: Record<string, unknown> }>;
  }
  export function htmlToText(html: string, options?: Options): string;
}

declare module "word-extractor" {
  class WordExtractor {
    extract(filePath: string): Promise<{ getBody: () => string }>;
  }
  export default WordExtractor;
}

declare module "xlsx" {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  export interface WorkSheet {
    [cell: string]: unknown;
  }
  export function readFile(path: string): WorkBook;
  export const utils: {
    sheet_to_csv(sheet: WorkSheet, options?: { FS?: string }): string;
  };
}

declare module "@xenova/transformers" {
  export type Tensor = {
    data: Float32Array | number[];
  };

  export type TransformerPipeline = (
    input: string,
    options?: Record<string, unknown>
  ) => Promise<Tensor>;

  export function pipeline(
    task: string,
    model?: string,
    options?: Record<string, unknown>
  ): Promise<TransformerPipeline>;
}
