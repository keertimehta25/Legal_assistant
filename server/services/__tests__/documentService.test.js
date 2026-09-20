import { jest } from '@jest/globals';

jest.mock('fs/promises');
jest.mock('pdf-parse/lib/pdf-parse.js', () => jest.fn());
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }));

import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { extractTextFromFile } from '../documentService.js';

describe('extractTextFromFile', () => {
    beforeEach(() => {
        fs.readFile.mockResolvedValue(Buffer.from('dummy'));
        fs.unlink.mockResolvedValue();
    });

    test('extracts text from a PDF and deletes the temp file', async () => {
        pdfParse.mockResolvedValue({ text: 'This is a lease agreement.' });

        const file = { path: '/tmp/x.pdf', mimetype: 'application/pdf', originalname: 'lease.pdf' };
        const text = await extractTextFromFile(file);

        expect(text).toBe('This is a lease agreement.');
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/x.pdf');
    });

    test('extracts text from a DOCX file', async () => {
        mammoth.extractRawText.mockResolvedValue({ value: 'This is a contract.' });

        const file = {
            path: '/tmp/x.docx',
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            originalname: 'contract.docx',
        };
        const text = await extractTextFromFile(file);

        expect(text).toBe('This is a contract.');
    });

    test('rejects unsupported file types', async () => {
        const file = { path: '/tmp/x.txt', mimetype: 'text/plain', originalname: 'notes.txt' };
        await expect(extractTextFromFile(file)).rejects.toThrow('Unsupported file type');
        expect(fs.unlink).toHaveBeenCalled(); // cleanup still happens
    });

    test('rejects a PDF with no extractable text (e.g. scanned image)', async () => {
        pdfParse.mockResolvedValue({ text: '   ' });
        const file = { path: '/tmp/x.pdf', mimetype: 'application/pdf', originalname: 'scan.pdf' };
        await expect(extractTextFromFile(file)).rejects.toThrow('No extractable text found');
    });

    test('always attempts cleanup even if parsing throws', async () => {
        pdfParse.mockRejectedValue(new Error('corrupt file'));
        const file = { path: '/tmp/x.pdf', mimetype: 'application/pdf', originalname: 'bad.pdf' };
        await expect(extractTextFromFile(file)).rejects.toThrow('Failed to extract text');
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/x.pdf');
    });
});
