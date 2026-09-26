import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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

// Enable reverse proxy support (Render/Vercel/Heroku load balancers)
app.set('trust proxy', 1);

// Security headers (CSP disabled - this is a JSON/API server, not a page host)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: restrict to the configured frontend origin(s) in production.
const defaultOrigins = [
    'https://legal-assistant-lyart.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];
const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : defaultOrigins;

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Every AI-backed route costs real API quota/money and can be hammered by a
// script. A generous but real ceiling protects the service without getting
// in the way of a normal demo/judging session.
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests - please slow down and try again shortly.' },
});
app.use('/api/', aiLimiter);

// Hard ceiling on any raw text sent directly in a JSON body (as opposed to a
// file upload, which is already capped by MAX_FILE_SIZE_BYTES). Prevents a
// client from bypassing the upload size limit by pasting huge text directly
// into /simplify, /analyze, /compare, or /ask and running up AI costs.
const MAX_TEXT_CHARS = 200_000;
function isTextWithinLimit(text) {
    return typeof text === 'string' && text.length <= MAX_TEXT_CHARS;
}

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        const isAllowed =
            ALLOWED_MIME_TYPES.has(file.mimetype) || file.originalname.toLowerCase().endsWith('.docx');
        if (!isAllowed) {
            return cb(new Error('Unsupported file type. Please upload a PDF or DOCX file.'));
        }
        cb(null, true);
    },
});

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

    if (errStr.includes('MAX_TOKENS') || errStr.includes('could not be parsed')) {
        return res.status(502).json({
            error: 'The AI response was too long and got cut off before finishing. Try again, or use a shorter/split document.',
            retryable: true,
        });
    }

    console.error('[API Error]', errStr);
    return res.status(500).json({ error: errStr });
}

app.get('/', (req, res) => {
    res.json({
        service: 'LegalLens API',
        status: 'ok',
        docs: 'This is the backend API only. See /api/health for a liveness check.',
    });
});

app.get('/api/health', async (req, res) => {
    try {
        const text = await generateWithFallback('Say hello');
        res.json({ message: text });
    } catch (error) {
        handleApiError(res, error);
    }
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const text = await extractTextFromFile(req.file);
        res.json({ text });
    } catch (error) {
        handleApiError(res, error);
    }
});

app.post('/api/simplify', async (req, res) => {
    try {
        const { text, readingLevel } = req.body;
        if (!text) return res.status(400).json({ error: 'text is required' });
        if (!isTextWithinLimit(text)) {
            return res.status(413).json({ error: `text exceeds the ${MAX_TEXT_CHARS.toLocaleString()} character limit` });
        }
        const result = await simplifyLegalText(text, readingLevel || 'general public');
        res.json({ simplifiedText: result });
    } catch (error) {
        handleApiError(res, error);
    }
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'text is required' });
        if (!isTextWithinLimit(text)) {
            return res.status(413).json({ error: `text exceeds the ${MAX_TEXT_CHARS.toLocaleString()} character limit` });
        }
        const result = await analyzeLegalDocument(text);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

app.post('/api/compare', async (req, res) => {
    try {
        const { docA, docB } = req.body;
        if (!docA || !docB) return res.status(400).json({ error: 'docA and docB are required' });
        if (!isTextWithinLimit(docA) || !isTextWithinLimit(docB)) {
            return res.status(413).json({ error: `each document exceeds the ${MAX_TEXT_CHARS.toLocaleString()} character limit` });
        }
        const result = await compareDocuments(docA, docB);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

app.post('/api/index-document', async (req, res) => {
    try {
        const { sessionId, text } = req.body;
        if (!sessionId || !text) return res.status(400).json({ error: 'sessionId and text are required' });
        if (!isTextWithinLimit(text)) {
            return res.status(413).json({ error: `text exceeds the ${MAX_TEXT_CHARS.toLocaleString()} character limit` });
        }
        await indexDocument(sessionId, text);
        res.json({ success: true });
    } catch (error) {
        handleApiError(res, error);
    }
});

app.post('/api/ask', async (req, res) => {
    try {
        const { sessionId, question } = req.body;
        if (!sessionId || !question) return res.status(400).json({ error: 'sessionId and question are required' });
        if (!isTextWithinLimit(question)) {
            return res.status(413).json({ error: `question exceeds the ${MAX_TEXT_CHARS.toLocaleString()} character limit` });
        }
        const result = await answerQuestion(sessionId, question);
        res.json(result);
    } catch (error) {
        handleApiError(res, error);
    }
});

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

// Global error handler — catches multer errors (bad file type / too large)
// so they return clean JSON instead of Express's default HTML error page.
// Note: the condition MUST be `instanceof multer.MulterError` only — adding
// `|| err` would make this always-truthy and swallow real 500s as 400s.
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message || 'File upload error' });
    }
    // fileFilter rejections come through as plain Errors, not MulterError
    if (err?.message?.includes('Unsupported file type')) {
        return res.status(415).json({ error: err.message });
    }
    next(err);
});

const PORT = process.env.PORT || 3000;

// Only start listening outside of the test environment - this is what makes
// the app testable with supertest without actually binding a port. Jest sets
// NODE_ENV=test automatically, so no extra config is needed for this to work.
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
