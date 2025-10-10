const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200;

export type Chunk = {
  id: string;
  content: string;
  start: number;
  end: number;
};

export function chunkText(
  text: string,
  options: { chunkSize?: number; chunkOverlap?: number } = {}
): Chunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const content = normalized.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        id: `${index}`,
        content,
        start,
        end,
      });
      index += 1;
    }

    if (end === normalized.length) {
      break;
    }

    start = Math.max(0, end - chunkOverlap);
    if (start >= normalized.length) {
      break;
    }
  }

  return chunks;
}
