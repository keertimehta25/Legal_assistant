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

// Wraps JSON.parse so a malformed/truncated AI response surfaces as a clear,
// user-facing message instead of a raw "Unterminated string in JSON..."
// SyntaxError bubbling straight to the frontend.
function parseModelJson(raw, context) {
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error(`[AI] Failed to parse JSON for ${context}:`, err.message);
        throw new Error(
            `The AI's response for ${context} could not be parsed - it may have been cut off. Please try again.`
        );
    }
}

// ─── Simplify ─────────────────────────────────────────────────────────────────
export const simplifyLegalText = async (text, readingLevel = 'general public') => {
    const prompt =
        `You are a legal document simplifier. Rewrite the ENTIRE legal document below in plain language at a "${readingLevel}" reading level.\n\n` +
        `IMPORTANT REQUIREMENTS:\n` +
        `- Do NOT summarize or skip sections. Cover every single clause and section from start to end.\n` +
        `- Maintain section-by-section structure so the simplified output maps directly to the original document.\n` +
        `- Preserve all important obligations, deadlines, and rights. Do not give legal advice — only explain what the text says in plain English.\n\n` +
        `Text:\n${text}`;

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
    return parseModelJson(raw, 'document analysis');
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
    return parseModelJson(raw, 'document comparison');
};

// ─── Embedding store (Gemini-only — no provider fallback needed for Q&A) ──────
// Bounded to MAX_SESSIONS to avoid unbounded memory growth on a long-running
// server; oldest session is evicted (simple FIFO, not true LRU).
const MAX_SESSIONS = 50;
const documentStore = new Map(); // Map<sessionId, Array<{ text, embedding }>>

function rememberSession(sessionId, embeddings) {
    if (documentStore.size >= MAX_SESSIONS && !documentStore.has(sessionId)) {
        const oldestKey = documentStore.keys().next().value;
        documentStore.delete(oldestKey);
    }
    documentStore.set(sessionId, embeddings);
}

// Embedding calls are network round-trips, so embedding chunks one-at-a-time
// (fully sequential) leaves most of the wait time idle. We embed in small
// concurrent batches instead - fast enough to matter on a multi-page
// document, while staying well under typical per-second API rate limits.
const EMBED_CONCURRENCY = 5;

export const indexDocument = async (sessionId, text) => {
    const words  = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += 500) {
        const chunk = words.slice(i, i + 500).join(' ');
        if (chunk.trim()) chunks.push(chunk);
    }

    const embeddings = [];
    for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
        const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
        const results = await Promise.all(
            batch.map((chunk) => embedWithRetry({ contents: chunk }))
        );
        results.forEach((result, idx) => {
            embeddings.push({ text: batch[idx], embedding: result.embeddings[0].values });
        });
    }

    rememberSession(sessionId, embeddings);
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
    return parseModelJson(raw, 'action checklist');
};
