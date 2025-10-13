export interface TextExtractionHandler {
  readonly id: string;
  readonly supportedExtensions: ReadonlySet<string>;
  extract(filePath: string): Promise<string>;
}

export function matchesExtension(
  handler: TextExtractionHandler,
  extension: string
) {
  return handler.supportedExtensions.has(extension);
}
