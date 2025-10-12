import { QdrantClient } from "@qdrant/js-client-rest";

const globalForQdrant = globalThis as unknown as {
  qdrantClient?: QdrantClient;
};

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

export function getQdrantClient(): QdrantClient {
  if (!QDRANT_URL) {
    throw new Error(
      "QDRANT_URL is not configured. Set the connection address in the .env file."
    );
  }

  if (!globalForQdrant.qdrantClient) {
    globalForQdrant.qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }

  return globalForQdrant.qdrantClient;
}
