# IKI Platform — Backend (Node.js + Express + MongoDB)

Backend for the Industrial Knowledge Intelligence platform. Handles auth, document
upload/metadata, and chat history — and bridges chat/upload requests to Member 3's
Python AI/RAG service.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, AI_SERVICE_URL
npm run dev             # nodemon, or `npm start` for plain node
```

Requires a running MongoDB instance (local `mongodb://localhost:27017/iki_platform`
or an Atlas URI) and, for chat/upload processing to fully complete, Member 3's AI
service reachable at `AI_SERVICE_URL`.

## Folder structure

```
backend/
  server.js              # entry point, middleware wiring
  config/db.js            # mongoose connection
  models/                 # User, Document, ChatMessage
  middleware/              # auth (JWT), upload (multer), validate, errorHandler
  controllers/              # route logic
  routes/                    # /api/auth, /api/documents, /api/chat
  uploads/                     # uploaded files land here (gitignored)
```

## Security included

- Passwords hashed with bcrypt (never stored/returned in plaintext)
- JWT auth on every route except register/login
- `helmet` for HTTP security headers, `cors` scoped to `CLIENT_URL`
- Rate limiting: 300 req/15min globally, 20 req/15min on `/api/auth`
- `express-validator` on register/login inputs
- File upload restricted to pdf/doc/docx/xls/xlsx/ppt/pptx, 25MB max
- Centralized error handler (no stack traces leaked to client)

## API Reference (for Member 1 – React frontend)

Base URL: `http://localhost:5000/api`
Auth: send `Authorization: Bearer <token>` header on all routes except register/login.

### Auth

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` | Returns `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, user }` |
| GET | `/auth/me` | — | Returns current user |

### Documents

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/documents/upload` | `multipart/form-data`, field name `file` | Kicks off AI processing async |
| GET | `/documents?page=1&limit=20` | — | List current user's documents |
| GET | `/documents/:id` | — | Single document + status |
| DELETE | `/documents/:id` | — | Deletes file + metadata |
| POST | `/documents/:id/reprocess` | — | Retries AI ingestion if it failed |

Document `processingStatus`: `uploaded → processing → ready` (or `failed`).
Poll `GET /documents/:id` after upload until `ready` before letting the user query it.

### Chat

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/chat/query` | `{ question, documentId? }` | Omit `documentId` to query the whole corpus |
| GET | `/chat/history?documentId=&page=1&limit=50` | — | Chat history, oldest first |
| DELETE | `/chat/history/:id` | — | Delete one message |

`POST /chat/query` response shape:
```json
{
  "success": true,
  "message": {
    "question": "...",
    "answer": "...",
    "citations": [{ "documentName": "...", "snippet": "...", "page": 4, "confidence": 0.87 }],
    "confidenceScore": 0.91,
    "createdAt": "..."
  }
}
```

## Contract expected from Member 3 (AI/RAG service)

The backend calls these two endpoints on `AI_SERVICE_URL` — Member 3's Python service
needs to expose them with this shape:

**`POST /ingest`**
```json
// request
{ "documentId": "mongo-id", "filePath": "/abs/path/on/disk", "fileType": "pdf", "originalName": "manual.pdf" }
// response
{ "aiDocumentId": "chroma-collection-id", "summary": "...", "keywords": ["..."] }
```

**`POST /query`**
```json
// request
{ "userId": "mongo-id", "question": "...", "documentId": "mongo-id or null" }
// response
{
  "answer": "...",
  "citations": [{ "documentId": "...", "documentName": "...", "snippet": "...", "page": 4, "confidence": 0.87 }],
  "confidenceScore": 0.91
}
```

If Member 3's service isn't ready yet, the backend still runs — uploads succeed and
sit in `processing`/`failed` status, and `/chat/query` returns a clean `502` instead
of crashing, so Member 1 can build the frontend against this API right now.

## Quick test without a frontend

```bash
# register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Hru","email":"hru@test.com","password":"test1234"}'

# login (copy the token from the response)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hru@test.com","password":"test1234"}'

# upload a file
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/sample.pdf"
```
