# LegalLens

A GenAI-powered legal document assistant that simplifies, compares, and answers questions about legal documents.

**Disclaimer**: LegalLens provides general information only and is not a substitute for advice from a licensed attorney.

## Features
- **Upload & Simplify**: Converts complex legal text into plain language.
- **Analysis Dashboard**: Extracts obligations, deadlines, and flags risky clauses.
- **Document Q&A**: Ask specific questions about your uploaded document.
- **Action Checklist**: Generates user-specific action items and suggested questions for a lawyer.

## Setup Instructions

### Backend (Node.js/Express)
1. Navigate to the `server` directory: `cd server`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your `GEMINI_API_KEY`.
4. Start the backend: `npm run dev` (Runs on http://localhost:3000)

### Frontend (React/Vite)
1. Open a new terminal and navigate to the `client` directory: `cd client`
2. Install dependencies: `npm install`
3. Start the frontend: `npm run dev` (Usually runs on http://localhost:5173)

## Tech Stack
- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, Multer, pdf-parse, mammoth
- AI: `@google/genai` (Gemini 2.5 Flash for generation, text-embedding-004 for vector search)