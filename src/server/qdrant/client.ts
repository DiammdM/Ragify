import { QdrantClient } from "@qdrant/js-client-rest";

const globalForQdrant = globalThis as unknown as {
  qdrantClient?: QdrantClient;
};

// const QDRANT_URL = process.env.QDRANT_URL;
// const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_URL = "http://127.0.0.1:6333";
const QDRANT_API_KEY = "diammd-sys";

export function getQdrantClient(): QdrantClient {
  if (!QDRANT_URL) {
    throw new Error("QDRANT_URL 未配置。请在 .env 中设置 Qdrant 连接地址。");
  }

  if (!globalForQdrant.qdrantClient) {
    globalForQdrant.qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }

  return globalForQdrant.qdrantClient;
}
