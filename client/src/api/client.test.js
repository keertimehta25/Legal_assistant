import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadDocument, analyzeDocument, compareDocuments } from './client';

describe('api client', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('uploadDocument posts FormData to /upload', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ text: 'extracted text' }) });

        const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
        const result = await uploadDocument(file);

        expect(result).toEqual({ text: 'extracted text' });
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toMatch(/\/upload$/);
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
    });

    test('analyzeDocument sends a JSON body', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ key_obligations: [] }) });

        const result = await analyzeDocument('Some legal text');

        expect(result).toEqual({ key_obligations: [] });
        const [, options] = global.fetch.mock.calls[0];
        expect(JSON.parse(options.body)).toEqual({ text: 'Some legal text' });
    });

    test('throws the backend error message when the response is not ok', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 503,
            json: async () => ({ error: 'AI service is busy, please try again.' }),
        });

        await expect(compareDocuments('A', 'B')).rejects.toThrow('AI service is busy, please try again.');
    });
});
