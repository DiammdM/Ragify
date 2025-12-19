# Ragify

A Next.js App Router RAG knowledge-base app with multilingual UI, document ingestion, reranking, model switching, and basic authentication/roles.

## Demo

Demo placeholder: drop your recording link or local asset here (for example, `[Watch the demo](./public/demo.mp4)` or a thumbnail linked to the video).

## Features

- Document library: upload PDFs, Word/Markdown/HTML, spreadsheets, and common code/text files with per-stage indexing progress; originals live in `data/uploads`.
- RAG chat: uses Qdrant for vector search with optional cross-encoder reranking, returning matched chunks and scores.
- Model controls: switch between OpenAI, Gemini, DeepSeek, or Ollama, and tune chunk size plus quick prompts.
- Auth and roles: register/login via cookie sessions; uploads, indexing, and user-role management are admin-only.
- Localization and theme: English/Chinese copy and light/dark themes built with Tailwind and shadcn/ui.

## Prerequisites

- Node.js 18+ and npm.
- MongoDB connection string (Prisma `DATABASE_URL`).
- Qdrant instance reachable over HTTP.
- Optional: huggingface.co access or pre-cached @xenova/transformers models.

## Quickstart

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```env
   DATABASE_URL="mongodb://127.0.0.1:27017/ragify"

   QDRANT_URL="http://localhost:6333"
   QDRANT_API_KEY=""
   QDRANT_COLLECTION="ragify_library_documents"

   # Embeddings (defaults to Xenova/bge-m3 cached in .cache/transformers)
   TRANSFORMERS_CACHE=".cache/transformers"
   TRANSFORMERS_LOCAL_FILES_ONLY=true
   TRANSFORMERS_ALLOW_REMOTE=false
   EMBEDDING_MODEL="Xenova/bge-m3"
   EMBEDDING_MODEL_FILE="sentence_transformers_int8"
   EMBEDDING_MODEL_QUANTIZED=false

   # Cross-encoder reranker (optional)
   CROSS_ENCODER_MODEL="Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2"
   CROSS_ENCODER_MODEL_FILE="model"
   CROSS_ENCODER_MODEL_QUANTIZED=false
   CROSS_ENCODER_LOCAL_FILES_ONLY=true
   CROSS_ENCODER_ALLOW_REMOTE=false

   # Indexing batches (optional)
   INDEXING_BATCH_SIZE=12
   QDRANT_UPSERT_BATCH_SIZE=32
   ```

3. Sync the database:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start the dev server (Turbopack, port 3000):

   ```bash
   npm run dev
   ```

## Auth and roles

- Register via `/register`, then log in at `/login`.
- Uploading/indexing and user-role management require the `admin` role. After creating your first user, set its `role` to `admin` in MongoDB (or Prisma Studio) to unlock these screens.

## Document ingestion

- Supported formats: pdf, doc/docx, md/mdx, html/htm, csv/tsv/xls/xlsx, and common source/text files (see `src/lib/library/file-types.ts` for the full list).
- Files are stored under `data/uploads`; keep them if you plan to re-index.
- Trigger indexing from the Library page; chunks are embedded and upserted to Qdrant using the configured model and batch sizes.

## Model cache (offline use)

The embedding pipeline defaults to cached `onnx/sentence_transformers_int8.onnx` weights. If the host cannot reach huggingface.co, download the models manually:

```sh
conda install huggingface_hub
huggingface-cli download Xenova/bge-m3 --local-dir .cache/transformers/Xenova/bge-m3
huggingface-cli download Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2 --local-dir .cache/transformers/Xenova/cross-encoder-ms-marco-MiniLM-L-6-v2
```

If reranker weights live elsewhere, set `CROSS_ENCODER_MODEL_PATH` to the repo-relative path inside `.cache/transformers` (for example, `cross-encoder/ms-marco-MiniLM-L-6-v2`), and adjust `CROSS_ENCODER_MODEL_FILE`, `CROSS_ENCODER_MODEL_QUANTIZED`, or the `*_ALLOW_REMOTE`/`*_LOCAL_FILES_ONLY` flags as needed.

## Scripts

- `npm run dev`: start the dev server.
- `npm run build`: create the production bundle.
- `npm run start`: run the production server.
- `npm run lint`: run ESLint.
