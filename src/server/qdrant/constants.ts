const DEFAULT_COLLECTION_NAME = "ragify_library_documents";

export const LIBRARY_COLLECTION_NAME =
  process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION_NAME;
