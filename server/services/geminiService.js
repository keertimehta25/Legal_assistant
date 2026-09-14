/**
 * geminiService.js
 *
 * All AI features for LegalLens.
 * Uses generateWithFallback from aiProvider.js — primary: Gemini, fallback: OpenAI.
 * Embeddings remain Gemini-only (geminiClient.js) since OpenAI embeddings require
 * a separate endpoint and billing setup.
 */

import { generateWithFallback } from '../aiProvider.js';
import { embedWithRetry }        from '../geminiClient.js';
import { Type }                   from '@google/genai';

// ─── JSON schema helpers ───────────────────────────────────────────────────────
// These are passed to Gemini as responseSchema objects.
// The same shape is described in plain text inside each prompt
// so OpenAI's JSON mode produces compatible output.

const ANALYSIS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        key_obligations:             { type: Type.ARRAY, items: { type: Type.STRING } },
        important_dates_or_deadlines:{ type: Type.ARRAY, items: { type: Type.STRING } },
        risky_or_unusual_clauses: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    clause_text:    { type: Type.STRING },
                    why_it_matters: { type: Type.STRING },
                    risk_level:     { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                },
            },
        },
        missing_or_unclear_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
};

const COMPARE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        topics: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    topic_name:  { type: Type.STRING },
                    differences: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description:        { type: Type.STRING },
                                more_favorable_doc: { type: Type.STRING },
                                reason:             { type: Type.STRING },
                            },
                        },
                    },
                    missing_clauses: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
            },
        },
    },
};

const CHECKLIST_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        action_checklist:     { type: Type.ARRAY, items: { type: Type.STRING } },
        questions_for_lawyer: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
};

// ─── Health check ─────────────────────────────────────────────────────────────
export const generateHealthResponse = async () => {
    return generateWithFallback('Say hello');
};

// ─── Simplify ─────────────────────────────────────────────────────────────────
export const simplifyLegalText = async (text, readingLevel = 'general public') => {
    const prompt =
        `Rewrite the following legal text in plain language at a "${readingLevel}" reading level. ` +
        `Preserve all important obligations and deadlines. Do not give legal advice — only explain ` +
        `what the text says.\n\nText:\n${text}`;

    return generateWithFallback(prompt);
};

// ─── Analyze ──────────────────────────────────────────────────────────────────
export const analyzeLegalDocument = async (text) => {
    const prompt =
        `Analyze the following legal document and return a JSON object with exactly these fields:\n` +
        `- key_obligations: array of strings\n` +
        `- important_dates_or_deadlines: array of strings\n` +
        `- risky_or_unusual_clauses: array of objects with fields clause_text (string), ` +
        `  why_it_matters (string), risk_level ("low"|"medium"|"high")\n` +
        `- missing_or_unclear_terms: array of strings\n\n` +
        `Document:\n${text}`;

    const raw = await generateWithFallback(prompt, ANALYSIS_SCHEMA);
    return JSON.parse(raw);
};

// ─── Compare ──────────────────────────────────────────────────────────────────
export const compareDocuments = async (docA, docB) => {
    const prompt =
        `Compare these two legal documents and return a JSON object with exactly this field:\n` +
        `- topics: array of objects, each with:\n` +
        `    - topic_name (string)\n` +
        `    - differences: array of objects with description (string), more_favorable_doc (string), reason (string)\n` +
        `    - missing_clauses: array of strings (clauses in one doc but not the other)\n\n` +
        `Group by topic (e.g. termination, payment, liability, confidentiality).\n\n` +
        `Document A:\n${docA}\n\nDocument B:\n${docB}`;

    const raw = await generateWithFallback(prompt, COMPARE_SCHEMA);
    return JSON.parse(raw);
};

// ─── Embedding store (Gemini-only — no provider fallback needed for Q&A) ──────
const documentStore = new Map(); // Map<sessionId, Array<{ text, embedding }>>

export const indexDocument = async (sessionId, text) => {
    const words  = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += 500) {
        chunks.push(words.slice(i, i + 500).join(' '));
    }

    const embeddings = [];
    for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const result = await embedWithRetry({ contents: chunk });
        embeddings.push({ text: chunk, embedding: result.embeddings[0].values });
    }

    documentStore.set(sessionId, embeddings);
};

function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Ask ──────────────────────────────────────────────────────────────────────
export const answerQuestion = async (sessionId, question) => {
    const embeddings = documentStore.get(sessionId) || [];
    if (embeddings.length === 0) {
        return { answer: 'No document indexed for this session.', chunks: [] };
    }

    const qResult  = await embedWithRetry({ contents: question });
    const qEmbed   = qResult.embeddings[0].values;

    const topChunks = embeddings
        .map(e => ({ text: e.text, score: cosineSimilarity(qEmbed, e.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => c.text);

    const prompt =
        `Use only the context below to answer the question. ` +
        `If the answer is not found in the context, say "This isn't addressed in the document".\n\n` +
        `Context:\n${topChunks.join('\n\n')}\n\nQuestion: ${question}`;

    const answer = await generateWithFallback(prompt);
    return { answer, chunks: topChunks };
};

// ─── Checklist ────────────────────────────────────────────────────────────────
export const generateChecklist = async (analysisResult) => {
    const prompt =
        `Based on the legal document analysis below, return a JSON object with exactly these fields:\n` +
        `- action_checklist: array of plain-language action items the user should take\n` +
        `- questions_for_lawyer: array of specific questions to ask a lawyer before signing\n\n` +
        `Analysis:\n${JSON.stringify(analysisResult, null, 2)}`;

    const raw = await generateWithFallback(prompt, CHECKLIST_SCHEMA);
    return JSON.parse(raw);
};
