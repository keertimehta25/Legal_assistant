import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function isOverloaded(err) {
    const s = String(err?.message || err);
    return s.includes('UNAVAILABLE') || s.includes('503') || s.includes('overloaded') || s.includes('high demand');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * embedWithRetry
 *
 * Embeddings are Gemini-only (OpenAI embeddings would need separate billing
 * setup), so this keeps simple retry logic rather than the full cross-provider
 * fallback chain used for generation in aiProvider.js.
 */
const EMBED_MODEL = 'gemini-embedding-2';
const EMBED_MAX_RETRIES = 3;
const EMBED_BACKOFF_MS = [1000, 2000, 4000];

export async function embedWithRetry(params) {
    let lastError;
    for (let attempt = 0; attempt < EMBED_MAX_RETRIES; attempt++) {
        try {
            return await genai.models.embedContent({ ...params, model: EMBED_MODEL });
        } catch (err) {
            lastError = err;
            if (!isOverloaded(err)) throw err;
            if (attempt < EMBED_MAX_RETRIES - 1) {
                const delay = EMBED_BACKOFF_MS[attempt];
                console.warn(`[Gemini Embed] Overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${EMBED_MAX_RETRIES})...`);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

export default genai;
