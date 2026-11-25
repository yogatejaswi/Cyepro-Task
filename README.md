# Hyundai Automotive Assistant

An authenticated React and NestJS application that ingests Hyundai PDF brochures, stores their files in MongoDB GridFS, embeds page aware text chunks locally with MiniLM, retrieves evidence through MongoDB Atlas Vector Search, and generates cited answers with Groq. Vehicle comparisons and recommendations use the same retrieval path. This provider choice replaces the original OpenAI design at the user's request.

## Architecture

```text
React/Vite ──JWT──> NestJS REST API ──> MongoDB Atlas
                           │                ├─ users, documents, chunks
                           │                ├─ conversations, messages, logs
                           │                └─ GridFS brochure files
                           ├──> local MiniLM embeddings
                           └──> Groq answer generation
```

`apps/server` owns authentication, authorization, document processing, retrieval, and generation. `apps/client` owns the public landing page and responsive research workspace. The landing page is at `/`, sign in and registration are at `/login` and `/register`, and the protected dashboard is at `/app`. All user data queries include the authenticated user ID. The API key and database URI stay on the server.

## Development checklist

- [x] React/Vite client with protected routes and responsive pages
- [x] NestJS REST API, JWT, bcrypt, validation, rate limiting
- [x] MongoDB schemas and durable GridFS PDF storage
- [x] PDF page extraction, chunking, embeddings, processing states, and recovery
- [x] Atlas vector retrieval, cited chat, comparison, recommendations
- [x] Environment templates, deployment configuration, API guide
- [x] Live Atlas connection, vector index creation, and auth/API smoke test
- [x] Live PDF ingestion with local embeddings and Atlas vector retrieval
- [x] Live Groq answer generation, citations, comparison, and recommendation
- [ ] GitHub remote, public deployment URLs, demonstration video (requires accounts and a live configured deployment)

## Local setup

Requires Node.js 22+, npm, a MongoDB Atlas cluster with Vector Search, and a Groq API key. The embedding model downloads from Hugging Face on first use; allow outbound access and provide a persistent model cache on hosted deployments.

1. `npm install` at the repository root.
2. Copy `apps/server/.env.example` to `apps/server/.env` and fill in `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters), and `GROQ_API_KEY`. Copy `apps/client/.env.example` to `apps/client/.env` if you need to change the API URL.
3. Create the vector index below in Atlas, or run `npm run atlas:index -w @hyundai/server` with the API environment loaded. Wait until its status is **Ready**.
4. Start the API with `npm run dev:server`. Start the client with `npm run dev:client` in another terminal.
5. Open `http://localhost:5173`, register, and upload a text based Hyundai PDF brochure. Scanned PDFs need OCR before upload; image only pages have no extractable text.

The API uses `http://localhost:4000/api` by default. Vite proxies `/api` to it. `npm run dev:server` loads `apps/server/.env` automatically when present.

### MongoDB Atlas Vector Search

Create a **Vector Search** index named `brochure_vector_index` on the `document_chunks` collection in the `hyundai_assistant` database. Use this JSON definition:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 384, "similarity": "cosine" },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "documentId" },
    { "type": "filter", "path": "vehicleModel" },
    { "type": "filter", "path": "variantName" }
  ]
}
```

The local `onnx-community/all-MiniLM-L6-v2-ONNX` model produces 384 dimensional vectors with mean pooling and normalization. Changing the embedding model requires rebuilding all chunks and updating the index dimensions. The API rejects embeddings of a different size. Atlas network access and database user permissions must allow the API host to connect. MongoDB Compass can inspect the same cluster with its Atlas connection URI; it is an inspection tool, not the database server.

### Configuration

| API variable | Purpose |
|---|---|
| `PORT` | HTTP port, default 4000 |
| `NODE_ENV` | Set to `production` in deployment |
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DNS_SERVERS` | Optional DNS resolver list when Node cannot resolve Atlas SRV records locally |
| `JWT_SECRET` | Long random signing key |
| `GROQ_API_KEY` | Server side Groq key for answer generation |
| `GROQ_MODEL` | Groq chat model, default `openai/gpt-oss-20b` |
| `EMBEDDING_MODEL` | Local embedding model; must produce 384 dimensions |
| `EMBEDDING_CACHE_DIR` | Optional persistent model download cache directory |
| `FRONTEND_URL` | Allowed CORS origin; comma separated for multiple origins |
| `VECTOR_INDEX_NAME` | Atlas index name |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Character chunk size and overlap |

Client: `VITE_API_BASE_URL` must be the full deployed API URL ending in `/api` on Vercel, or `/api` for local proxying. Never place the Groq key or MongoDB URI in a `VITE_` variable.

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

**Render:** Use the root `render.yaml` Blueprint. It builds with `npm ci --include=dev && npm run build -w @hyundai/server` and starts with `npm run start -w @hyundai/server`. Configure the API environment variables and set `FRONTEND_URL` to the exact Vercel origin. GridFS avoids reliance on Render's ephemeral filesystem.

**Vercel:** Import the repository, set root directory `apps/client`, framework Vite, build command `npm run build`, output directory `dist`, and `VITE_API_BASE_URL=https://YOUR-RENDER-HOST/api`. The `vercel.json` rewrite supports client routes. After deployment, update `FRONTEND_URL` on Render and redeploy it.

**GitHub:** Create a private or public repository, add it as a remote, and push this source tree after reviewing `.gitignore`. No real `.env` files should be committed.

## Verification

Run `npm run build` and `npm test`. These check TypeScript, client bundling, and document processing helpers, including a real PDF byte stream. With the API running and Atlas configured, `npm run test:live -w @hyundai/server` checks registration, login, protected routes, and invalid upload. Set `BROCHURE_FILE` to a PDF path to also check GridFS upload, status, authorized preview, model correction, and deletion. With `BROCHURE_FILE` and a Groq key configured, `npm run test:rag -w @hyundai/server` ingests the brochure, waits for processing, checks a cited answer, a follow up, and an unsupported question, then cleans up its test account and document. Set `SECOND_BROCHURE_FILE` to another model's PDF to include comparison and recommendation checks. A failed vector index query means the Atlas index is absent or not ready; it is not silently replaced with another retrieval method.

## Operational notes

PDF content is untrusted reference material. The generation instructions explicitly forbid following instructions in brochure text and require evidence for factual claims. The service stores retrieved excerpts with responses for auditing. Atlas vector retrieval can still surface irrelevant text; check important details in the original PDF. For higher throughput, move ingestion to a durable worker queue and add document level audit telemetry. JWTs currently live in browser local storage; use a secure cookie or a dedicated identity provider if your threat model requires stronger browser token isolation.
