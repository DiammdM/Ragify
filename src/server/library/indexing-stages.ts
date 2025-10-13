export const INDEXING_STAGES = [
  "extracting",
  "chunking",
  "embedding",
  "saving",
] as const;

export type IndexingStage = (typeof INDEXING_STAGES)[number];
