import { jest } from '@jest/globals';

jest.mock('../services/geminiService.js', () => ({
    simplifyLegalText: jest.fn(),
    analyzeLegalDocument: jest.fn(),
    compareDocuments: jest.fn(),
    indexDocument: jest.fn(),
    answerQuestion: jest.fn(),
    generateChecklist: jest.fn(),
}));
jest.mock('../services/documentService.js', () => ({ extractTextFromFile: jest.fn() }));
jest.mock('../aiProvider.js', () => ({ generateWithFallback: jest.fn() }));

import request from 'supertest';
import app from '../index.js';
import { generateWithFallback } from '../aiProvider.js';
import { simplifyLegalText, analyzeLegalDocument } from '../services/geminiService.js';

describe('API routes', () => {
    test('GET /api/health returns the model response', async () => {
        generateWithFallback.mockResolvedValue('Hello!');
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Hello!');
    });

    test('POST /api/simplify requires text', async () => {
        const res = await request(app).post('/api/simplify').send({});
        expect(res.status).toBe(400);
    });

    test('POST /api/simplify returns simplified text', async () => {
        simplifyLegalText.mockResolvedValue('Plain language version.');
        const res = await request(app)
            .post('/api/simplify')
            .send({ text: 'Legal text', readingLevel: 'simple' });

        expect(res.status).toBe(200);
        expect(res.body.simplifiedText).toBe('Plain language version.');
        expect(simplifyLegalText).toHaveBeenCalledWith('Legal text', 'simple');
    });

    test('POST /api/analyze returns a friendly 503 when the AI service is overloaded', async () => {
        analyzeLegalDocument.mockRejectedValue(new Error('{"error":{"status":"UNAVAILABLE"}}'));
        const res = await request(app).post('/api/analyze').send({ text: 'Lease text' });

        expect(res.status).toBe(503);
        expect(res.body.retryable).toBe(true);
    });

    test('POST /api/upload requires a file', async () => {
        const res = await request(app).post('/api/upload');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/No file uploaded/);
    });

    test('POST /api/checklist requires analysisResult', async () => {
        const res = await request(app).post('/api/checklist').send({});
        expect(res.status).toBe(400);
    });
});
