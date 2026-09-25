import { jest } from '@jest/globals';

// ─── Mocks (must come before any imports that use them) ────────────────────────
jest.mock('../services/geminiService.js', () => ({
    simplifyLegalText:   jest.fn(),
    analyzeLegalDocument: jest.fn(),
    compareDocuments:    jest.fn(),
    indexDocument:       jest.fn(),
    answerQuestion:      jest.fn(),
    generateChecklist:   jest.fn(),
}));
jest.mock('../services/documentService.js', () => ({ extractTextFromFile: jest.fn() }));
jest.mock('../aiProvider.js', () => ({ generateWithFallback: jest.fn() }));

import request from 'supertest';
import app from '../index.js';
import { generateWithFallback } from '../aiProvider.js';
import {
    simplifyLegalText,
    analyzeLegalDocument,
    compareDocuments,
    indexDocument,
    answerQuestion,
    generateChecklist,
} from '../services/geminiService.js';
import { extractTextFromFile } from '../services/documentService.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const SAMPLE_ANALYSIS = {
    key_obligations: ['Pay rent by the 1st'],
    important_dates_or_deadlines: ['Lease ends Dec 31'],
    risky_or_unusual_clauses: [],
    missing_or_unclear_terms: [],
};

// ─── Test suites ───────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
    test('returns the model response on success', async () => {
        generateWithFallback.mockResolvedValue('Hello!');
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Hello!');
    });

    test('includes x-content-type-options security header', async () => {
        generateWithFallback.mockResolvedValue('Hello!');
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
});

describe('POST /api/upload', () => {
    test('returns 400 when no file is attached', async () => {
        const res = await request(app).post('/api/upload');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/No file uploaded/);
    });
});

describe('POST /api/simplify', () => {
    test('returns 400 when text is missing', async () => {
        const res = await request(app).post('/api/simplify').send({});
        expect(res.status).toBe(400);
    });

    test('returns simplified text on success', async () => {
        simplifyLegalText.mockResolvedValue('Plain language version.');
        const res = await request(app)
            .post('/api/simplify')
            .send({ text: 'Legal text', readingLevel: 'simple' });

        expect(res.status).toBe(200);
        expect(res.body.simplifiedText).toBe('Plain language version.');
        expect(simplifyLegalText).toHaveBeenCalledWith('Legal text', 'simple');
    });

    test('returns 413 when text exceeds character limit', async () => {
        const res = await request(app)
            .post('/api/simplify')
            .send({ text: 'a'.repeat(200_001) });

        expect(res.status).toBe(413);
        expect(simplifyLegalText).not.toHaveBeenCalled();
    });
});

describe('POST /api/analyze', () => {
    test('returns 400 when text is missing', async () => {
        const res = await request(app).post('/api/analyze').send({});
        expect(res.status).toBe(400);
    });

    test('returns structured analysis on success', async () => {
        analyzeLegalDocument.mockResolvedValue(SAMPLE_ANALYSIS);
        const res = await request(app).post('/api/analyze').send({ text: 'Lease agreement...' });

        expect(res.status).toBe(200);
        expect(res.body.key_obligations).toEqual(['Pay rent by the 1st']);
        expect(analyzeLegalDocument).toHaveBeenCalledWith('Lease agreement...');
    });

    test('returns 413 when text exceeds character limit', async () => {
        const res = await request(app)
            .post('/api/analyze')
            .send({ text: 'a'.repeat(200_001) });

        expect(res.status).toBe(413);
    });

    test('maps UNAVAILABLE Gemini error to 503 with retryable flag', async () => {
        analyzeLegalDocument.mockRejectedValue(new Error('{"error":{"status":"UNAVAILABLE"}}'));
        const res = await request(app).post('/api/analyze').send({ text: 'Lease text' });

        expect(res.status).toBe(503);
        expect(res.body.retryable).toBe(true);
    });
});

describe('POST /api/compare', () => {
    test('returns 400 when docA is missing', async () => {
        const res = await request(app).post('/api/compare').send({ docB: 'Some text' });
        expect(res.status).toBe(400);
    });

    test('returns 400 when docB is missing', async () => {
        const res = await request(app).post('/api/compare').send({ docA: 'Some text' });
        expect(res.status).toBe(400);
    });

    test('returns 413 when docA exceeds character limit', async () => {
        const res = await request(app)
            .post('/api/compare')
            .send({ docA: 'a'.repeat(200_001), docB: 'short' });

        expect(res.status).toBe(413);
    });

    test('returns comparison result on success', async () => {
        const mockResult = { topics: [{ topic_name: 'Termination', differences: [], missing_clauses: [] }] };
        compareDocuments.mockResolvedValue(mockResult);
        const res = await request(app)
            .post('/api/compare')
            .send({ docA: 'Contract A text', docB: 'Contract B text' });

        expect(res.status).toBe(200);
        expect(res.body.topics[0].topic_name).toBe('Termination');
    });
});

describe('POST /api/index-document', () => {
    test('returns 400 when sessionId is missing', async () => {
        const res = await request(app).post('/api/index-document').send({ text: 'doc text' });
        expect(res.status).toBe(400);
    });

    test('returns 400 when text is missing', async () => {
        const res = await request(app).post('/api/index-document').send({ sessionId: 'abc123' });
        expect(res.status).toBe(400);
    });

    test('returns success:true on successful indexing', async () => {
        indexDocument.mockResolvedValue(undefined);
        const res = await request(app)
            .post('/api/index-document')
            .send({ sessionId: 'abc123', text: 'Document content' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('POST /api/ask', () => {
    test('returns 400 when sessionId is missing', async () => {
        const res = await request(app).post('/api/ask').send({ question: 'What is the term?' });
        expect(res.status).toBe(400);
    });

    test('returns 400 when question is missing', async () => {
        const res = await request(app).post('/api/ask').send({ sessionId: 'abc123' });
        expect(res.status).toBe(400);
    });

    test('returns answer on success', async () => {
        answerQuestion.mockResolvedValue({ answer: 'The term is 12 months.', chunks: [] });
        const res = await request(app)
            .post('/api/ask')
            .send({ sessionId: 'abc123', question: 'What is the term?' });

        expect(res.status).toBe(200);
        expect(res.body.answer).toBe('The term is 12 months.');
    });
});

describe('POST /api/checklist', () => {
    test('returns 400 when analysisResult is missing', async () => {
        const res = await request(app).post('/api/checklist').send({});
        expect(res.status).toBe(400);
    });

    test('returns checklist on success', async () => {
        const mockChecklist = {
            action_checklist: ['Review termination clause'],
            questions_for_lawyer: ['Is the liability cap standard?'],
        };
        generateChecklist.mockResolvedValue(mockChecklist);
        const res = await request(app)
            .post('/api/checklist')
            .send({ analysisResult: SAMPLE_ANALYSIS });

        expect(res.status).toBe(200);
        expect(res.body.action_checklist[0]).toBe('Review termination clause');
    });
});
