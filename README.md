# Hyundai Automotive Assistant

An authenticated React and NestJS application that ingests Hyundai PDF brochures, stores their files in MongoDB GridFS, embeds page aware text chunks with OpenAI, retrieves evidence through MongoDB Atlas Vector Search, and generates cited answers. Vehicle comparisons and recommendations use the same retrieval path.

## Architecture

```text
React/Vite ──JWT──> NestJS REST API ──> MongoDB Atlas
                           │                ├─ users, documents, chunks
                           │                ├─ conversations, messages, logs
                           │                └─ GridFS brochure files
                           └──> OpenAI embeddings + responses
```

`apps/api` owns authentication, authorization, document processing, retrieval, and generation. `apps/web` owns the responsive client. All user data queries include the authenticated user ID. The API key and database URI stay on the server.

## Development checklist

- [x] React/Vite client with protected routes and responsive pages
- [x] NestJS REST API, JWT, bcrypt, validation, rate limiting
- [x] MongoDB schemas and durable GridFS PDF storage
- [x] PDF page extraction, chunking, embeddings, processing states, and recovery
- [x] Atlas vector retrieval, cited chat, comparison, recommendations
- [x] Environment templates, deployment configuration, API guide
- [x] Live Atlas connection, vector index creation, and auth/API smoke test
- [ ] Live OpenAI embedding, vector retrieval, and generated answer verification (requires an API key)
- [ ] GitHub remote, public deployment URLs, demonstration video (requires accounts and a live configured deployment)

## Local setup

Requires Node.js 22+, npm, a MongoDB Atlas cluster with Vector Search, and an OpenAI API key.

1. `npm install` at the repository root.
2. Copy `apps/api/.env.example` to `apps/api/.env` and fill in `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters), and `OPENAI_API_KEY`. Copy `apps/web/.env.example` to `apps/web/.env` if you need to change the API URL.
3. Create the vector index below in Atlas, or run `npm run atlas:index -w @hyundai/api` with the API environment loaded. Wait until its status is **Ready**.
4. Start the API with `npm run dev:api`. Start the client with `npm run dev:web` in another terminal.
5. Open `http://localhost:5173`, register, and upload a text based Hyundai PDF brochure. Scanned PDFs need OCR before upload; image only pages have no extractable text.

The API uses `http://localhost:4000/api` by default. Vite proxies `/api` to it. `npm run dev:api` loads `apps/api/.env` automatically when present.

### MongoDB Atlas Vector Search

Create a **Vector Search** index named `brochure_vector_index` on the `document_chunks` collection in the `hyundai_assistant` database. Use this JSON definition:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "documentId" },
    { "type": "filter", "path": "vehicleModel" },
    { "type": "filter", "path": "variantName" }
  ]
}
```

`text-embedding-3-small` produces 1536 dimensions with the default setting. Changing the embedding model requires rebuilding all chunks and updating the index dimensions. The API rejects embeddings of a different size. Atlas network access and database user permissions must allow the API host to connect. MongoDB Compass can inspect the same cluster with its Atlas connection URI; it is an inspection tool, not the database server.

### Configuration

| API variable | Purpose |
|---|---|
| `PORT` | HTTP port, default 4000 |
| `NODE_ENV` | Set to `production` in deployment |
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DNS_SERVERS` | Optional DNS resolver list when Node cannot resolve Atlas SRV records locally |
| `JWT_SECRET` | Long random signing key |
| `OPENAI_API_KEY` | Server side OpenAI key |
| `OPENAI_MODEL` | Responses API model, default `gpt-4.1-mini` |
| `OPENAI_EMBEDDING_MODEL` | Must produce 1536 dimensions; default `text-embedding-3-small` |
| `FRONTEND_URL` | Allowed CORS origin; comma separated for multiple origins |
| `VECTOR_INDEX_NAME` | Atlas index name |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Character chunk size and overlap |

Client: `VITE_API_BASE_URL` must be the full deployed API URL ending in `/api` on Vercel, or `/api` for local proxying. Never place the OpenAI key or MongoDB URI in a `VITE_` variable.

## API

All routes are prefixed `/api`. Except register and login, send `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register` | `{name,email,password}`; create account and token |
| POST | `/auth/login` | `{email,password}`; get token |
| GET | `/auth/profile` | Current account |
| POST | `/documents/upload` | Multipart `file` PDF, optional `vehicleModel` |
| GET | `/documents` | Own documents |
| GET | `/documents/:id` | Own document metadata |
| PATCH | `/documents/:id` | `{vehicleModel}`; correct a completed or failed brochure's model |
| GET | `/documents/:id/status` | Processing status and error |
| GET | `/documents/:id/file` | Authorized PDF preview/download |
| POST | `/documents/:id/reprocess` | Retry a failed document |
| DELETE | `/documents/:id` | Remove PDF, chunks, and logs |
| POST | `/chat` | `{message,conversationId?,documentIds?}`; cited answer |
| GET | `/chat/conversations` | Own conversation list |
| GET | `/chat/conversations/:id` | Conversation and messages |
| DELETE | `/chat/conversations/:id` | Delete conversation |
| GET | `/vehicles` | Models from completed brochures |
| GET | `/vehicles/:model` | Model and brochure metadata |
| POST | `/vehicles/compare` | `{models:[...],focus?}`; evidence based comparison |
| POST | `/vehicles/recommend` | `{requirements}`; evidence based recommendation |

Upload returns `Pending`; the API asynchronously transitions through `Processing` to `Completed` or `Failed`. Only completed documents are used for retrieval. Errors return standard NestJS JSON and HTTP status codes. AI endpoints are limited to 12 requests per minute per client; other endpoints to 120 per minute.

## Deployment

**Render:** Create a Node web service from this repository, set the root to the repository root, build command `npm ci && npm run build -w @hyundai/api`, start command `npm run start -w @hyundai/api`, and configure the API environment variables. Set `FRONTEND_URL` to the exact Vercel origin. Use a supported Node 22+ runtime. GridFS avoids reliance on Render's ephemeral filesystem.

**Vercel:** Import the repository, set root directory `apps/web`, framework Vite, build command `npm run build`, output directory `dist`, and `VITE_API_BASE_URL=https://YOUR-RENDER-HOST/api`. The `vercel.json` rewrite supports client routes. After deployment, update `FRONTEND_URL` on Render and redeploy it.

**GitHub:** Create a private or public repository, add it as a remote, and push this source tree after reviewing `.gitignore`. No real `.env` files should be committed.

## Verification

Run `npm run build` and `npm test`. These check TypeScript, client bundling, and document processing helpers, including a real PDF byte stream. With the API running and Atlas configured, `npm run test:live -w @hyundai/api` checks registration, login, protected routes, and invalid upload. Set `BROCHURE_FILE` to a PDF path to also check GridFS upload, status, authorized preview, model correction, and deletion. With `BROCHURE_FILE` and an OpenAI key configured, `npm run test:rag -w @hyundai/api` ingests the brochure, waits for processing, checks a cited answer, and cleans up its test account and document. A failed vector index query means the Atlas index is absent or not ready; it is not silently replaced with another retrieval method.

## Operational notes

PDF content is untrusted reference material. The generation instructions explicitly forbid following instructions in brochure text and require evidence for factual claims. The service stores retrieved excerpts with responses for auditing. Atlas vector retrieval can still surface irrelevant text; check important details in the original PDF. For higher throughput, move ingestion to a durable worker queue and add document level audit telemetry. JWTs currently live in browser local storage; use a secure cookie or a dedicated identity provider if your threat model requires stronger browser token isolation.
