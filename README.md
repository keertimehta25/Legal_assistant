# LegalLens

A GenAI-powered legal document assistant that simplifies, compares, and answers questions about legal documents.

**Disclaimer**: LegalLens provides general information only and is not a substitute for advice from a licensed attorney.

## Features
- **Upload & Simplify**: Upload a PDF/DOCX and rewrite it in plain language at the reading level you choose (general public / 8th grade / expert summary).
- **Analysis Dashboard**: Extracts obligations, deadlines, and flags risky clauses.
- **Document Comparison**: Compares two documents topic-by-topic and flags which version is more favorable.
- **Document Q&A**: Ask specific questions about your uploaded document, answered from the relevant passages (retrieval over embeddings), with source excerpts shown.
- **Action Checklist**: Generates user-specific action items and suggested questions for a lawyer.

## Setup Instructions

### Backend (Node.js/Express)
1. Navigate to the `server` directory: `cd server`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your `GEMINI_API_KEY`. Optionally set `CLIENT_ORIGIN` to your frontend's URL to restrict CORS in production (defaults to allowing any origin, for local dev).
4. Start the backend: `npm run dev` (Runs on http://localhost:3000)

### Frontend (React/Vite)
1. Open a new terminal and navigate to the `client` directory: `cd client`
2. Install dependencies: `npm install`
3. Start the frontend: `npm run dev` (Usually runs on http://localhost:5173)

## Tech Stack
- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, Multer, pdf-parse, mammoth
- AI: `@google/genai` (Gemini 2.5 Flash for generation, text-embedding-004 for vector search)
- Security: Helmet security headers, per-IP rate limiting on AI-backed routes, request-size/text-length caps, restricted file-type upload validation

## Security & Efficiency Notes
- Uploaded files are parsed in-memory and the temp copy is deleted immediately after text extraction (see `server/services/documentService.js`).
- All AI-backed routes (`/api/*`) are rate-limited per IP, and raw text sent directly in a JSON body is capped at 200,000 characters, so the service can't be abused into runaway AI-provider costs by uploads that bypass the file-size limit.
- Document Q&A embeds a document's text chunks concurrently (batches of 5) instead of one request at a time, cutting indexing latency on multi-page documents.
- CORS is restricted to `CLIENT_ORIGIN` when set; session IDs use `crypto.randomUUID()`.

## Testing
- Backend: `cd server && npm test` (Jest + Supertest)
- Frontend: `cd client && npm test` (Vitest + Testing Library)

## Accessibility
- Skip-to-content link, landmark roles (`nav`, `main`), and `aria-live` regions for async status updates (upload progress, chat replies, errors).
- All form controls (file inputs, checklist checkboxes, chat input, reading-level selector) have associated `<label>`s.
- The chat panel toggle is a real `<button>` with `aria-expanded`/`aria-controls` rather than a clickable `<div>`, so it works with keyboard and screen readers.