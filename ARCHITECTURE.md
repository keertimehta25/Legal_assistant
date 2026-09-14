# LegalLens Architecture

## Overview
LegalLens is a full-stack GenAI application built with:
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **GenAI**: Google Gemini API (`@google/genai`)

## System Flow

```mermaid
graph TD
    Client[React Frontend] -->|Upload PDF/DOCX| Express[Node.js Backend]
    Express -->|Parse File| Extractor[pdf-parse / mammoth]
    Extractor -->|Raw Text| Express
    
    Express -->|Analyze/Simplify| Gemini[Gemini 2.5 Flash API]
    Gemini -->|Structured JSON| Express
    Express -->|Parsed JSON| Client
    
    Express -->|Index Document| Embed[Gemini Embedding 004 API]
    Embed -->|Vectors| Memory[In-Memory Store]
    
    Client -->|Ask Question| Express
    Express -->|Embed Query| Embed
    Embed -->|Query Vector| Memory
    Memory -->|Top 3 Chunks| Express
    Express -->|Context + Query| Gemini
    Gemini -->|Answer| Client
```

## Security & Data
- User uploaded documents are temporarily saved in `server/uploads/` during text extraction and deleted immediately after.
- Document text and vector embeddings are stored **in-memory only** on the backend using a simple map keyed by a random `sessionId`. When the Node process stops, data is destroyed.
