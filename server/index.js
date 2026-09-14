import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

import { generateWithFallback } from './aiProvider.js';
import { extractTextFromFile } from './services/documentService.js';
import {
    simplifyLegalText,
    analyzeLegalDocument,
    compareDocuments,
    indexDocument,
    answerQuestion,
    generateChecklist
} from './services/geminiService.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: 'uploads/' });

/**
 * Central error response helper — returns a user-friendly message
 * when Gemini is overloaded, vs. a raw error for other failures.
 */
function handleApiError(res, error) {
    const errStr = String(error?.message || error);
    const isOverloaded =
        errStr.includes('UNAVAILABLE') ||
        errStr.includes('overloaded') ||
        errStr.includes('high demand') ||
        errStr.includes('503');

    if (isOverloaded) {
        return res.status(503).json({
            error: 'The AI service is experiencing high demand right now. Please try again in a moment.',
            retryable: true,
        });
    }

    console.error('[API Error]', errStr);
    return res.status(500).json({ error: errStr });
}

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    try {
        const text = await generateWithFallback('Say hello');
        res.json({ message: text });
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Upload ──────────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const text = await extractTextFromFile(req.file);
        res.json({ text });
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Simplify ────────────────────────────────────────────────────────────────
app.post('/api/simplify', async (req, res) => {
    try {
        const { text, readingLevel } = req.body;
        if (!text) return res.status(400).json({ error: 'text is required' });
        const result = await simplifyLegalText(text, readingLevel || 'general public');
        res.json({ simplifiedText: result });
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Analyze ─────────────────────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'text is required' });
        const result = await analyzeLegalDocument(text);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Compare ─────────────────────────────────────────────────────────────────
app.post('/api/compare', async (req, res) => {
    try {
        const { docA, docB } = req.body;
        if (!docA || !docB) return res.status(400).json({ error: 'docA and docB are required' });
        const result = await compareDocuments(docA, docB);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Index Document (for Q&A embeddings) ─────────────────────────────────────
app.post('/api/index-document', async (req, res) => {
    try {
        const { sessionId, text } = req.body;
        if (!sessionId || !text) return res.status(400).json({ error: 'sessionId and text are required' });
        await indexDocument(sessionId, text);
        res.json({ success: true });
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Ask Question ─────────────────────────────────────────────────────────────
app.post('/api/ask', async (req, res) => {
    try {
        const { sessionId, question } = req.body;
        if (!sessionId || !question) return res.status(400).json({ error: 'sessionId and question are required' });
        const result = await answerQuestion(sessionId, question);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

// ─── Generate Checklist ───────────────────────────────────────────────────────
app.post('/api/checklist', async (req, res) => {
    try {
        const { analysisResult } = req.body;
        if (!analysisResult) return res.status(400).json({ error: 'analysisResult is required' });
        const result = await generateChecklist(analysisResult);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
