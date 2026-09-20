import { jest } from '@jest/globals';

jest.mock('../../aiProvider.js', () => ({ generateWithFallback: jest.fn() }));
jest.mock('../../geminiClient.js', () => ({ embedWithRetry: jest.fn() }));

import { generateWithFallback } from '../../aiProvider.js';
import { embedWithRetry } from '../../geminiClient.js';
import {
    simplifyLegalText,
    analyzeLegalDocument,
    compareDocuments,
    indexDocument,
    answerQuestion,
    generateChecklist,
} from '../geminiService.js';

describe('geminiService', () => {
    test('simplifyLegalText forwards text and reading level in the prompt', async () => {
        generateWithFallback.mockResolvedValue('Simplified text output');
        const result = await simplifyLegalText('Some legal text', 'general public');

        expect(result).toBe('Simplified text output');
        expect(generateWithFallback).toHaveBeenCalledWith(expect.stringContaining('Some legal text'));
        expect(generateWithFallback).toHaveBeenCalledWith(expect.stringContaining('general public'));
    });

    test('analyzeLegalDocument parses the JSON response and passes a schema', async () => {
        const mockAnalysis = {
            key_obligations: ['Pay rent monthly'],
            important_dates_or_deadlines: ['March 15, 2026'],
            risky_or_unusual_clauses: [],
            missing_or_unclear_terms: [],
        };
        generateWithFallback.mockResolvedValue(JSON.stringify(mockAnalysis));

        const result = await analyzeLegalDocument('Lease text here');

        expect(result).toEqual(mockAnalysis);
        expect(generateWithFallback).toHaveBeenCalledWith(
            expect.stringContaining('Lease text here'),
            expect.objectContaining({ type: expect.anything() })
        );
    });

    test('compareDocuments includes both documents in the prompt', async () => {
        const mockCompare = { topics: [{ topic_name: 'Payment', differences: [], missing_clauses: [] }] };
        generateWithFallback.mockResolvedValue(JSON.stringify(mockCompare));

        const result = await compareDocuments('Doc A text', 'Doc B text');

        expect(result).toEqual(mockCompare);
        expect(generateWithFallback.mock.calls[0][0]).toContain('Doc A text');
        expect(generateWithFallback.mock.calls[0][0]).toContain('Doc B text');
    });

    test('indexDocument chunks long text into ~500-word pieces and embeds each', async () => {
        embedWithRetry.mockResolvedValue({ embeddings: [{ values: [1, 0, 0] }] });

        const longText = new Array(1200).fill('word').join(' '); // -> 3 chunks (500/500/200)
        await indexDocument('session-chunks', longText);

        expect(embedWithRetry).toHaveBeenCalledTimes(3);
    });

    test('answerQuestion returns a fallback message when no document is indexed', async () => {
        const result = await answerQuestion('never-indexed-session', 'What is the rent?');
        expect(result.answer).toMatch(/No document indexed/i);
        expect(result.chunks).toEqual([]);
    });

    test('answerQuestion retrieves the indexed chunk and asks the model', async () => {
        embedWithRetry.mockResolvedValue({ embeddings: [{ values: [1, 0, 0] }] });
        await indexDocument('session-qa', 'Rent is 42000 rupees per month');

        generateWithFallback.mockResolvedValue('The monthly rent is Rs. 42,000.');
        const result = await answerQuestion('session-qa', 'How much is the rent?');

        expect(result.answer).toBe('The monthly rent is Rs. 42,000.');
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(generateWithFallback).toHaveBeenCalledWith(expect.stringContaining('How much is the rent?'));
    });

    test('generateChecklist parses action items and lawyer questions', async () => {
        const mockChecklist = {
            action_checklist: ['Review deposit terms'],
            questions_for_lawyer: ['Is the uncapped late fee enforceable?'],
        };
        generateWithFallback.mockResolvedValue(JSON.stringify(mockChecklist));

        const result = await generateChecklist({ key_obligations: [] });
        expect(result).toEqual(mockChecklist);
    });
});
