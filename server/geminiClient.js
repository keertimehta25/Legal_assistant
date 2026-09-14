import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** Models tried in order when a 503/UNAVAILABLE is encountered */
const FALLBACK_CHAIN = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash-lite',
];

/** Returns true only for transient overload / unavailability errors */
function isOverloaded(err) {
    const s = String(err?.message || err);
    return (
        s.includes('UNAVAILABLE') ||
        s.includes('503') ||
        s.includes('overloaded') ||
        s.includes('high demand')
    );
}

/** Sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * generateWithFallback
 *
 * Tries each model in FALLBACK_CHAIN. For each model it attempts up to
 * MAX_RETRIES_PER_MODEL times with exponential backoff (1 s, 2 s) on
 * 503/UNAVAILABLE errors only. Non-availability errors throw immediately.
 * If all retries for a model are exhausted it moves to the next model.
 * If every model in the chain is exhausted it throws the last error.
 *
 * @param {object} params - Same params as genai.models.generateContent,
 *                          but WITHOUT a `model` key (it is injected here).
 * @returns {Promise<object>} generateContent response
 */
const MAX_RETRIES_PER_MODEL = 2;
const BACKOFF_MS = [1000, 2000]; // delay before attempt 2, attempt 3

export async function generateWithFallback(params) {
    let lastError;

    for (const model of FALLBACK_CHAIN) {
        for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
            try {
                const response = await genai.models.generateContent({ ...params, model });
                if (model !== FALLBACK_CHAIN[0]) {
                    // Let developers know a fallback was used
                    console.info(`[Gemini] Used fallback model: ${model}`);
                }
                return response;
            } catch (err) {
                lastError = err;

                if (!isOverloaded(err)) {
                    // Hard failure — don't retry or fall through
                    throw err;
                }

                if (attempt < MAX_RETRIES_PER_MODEL - 1) {
                    const delay = BACKOFF_MS[attempt];
                    console.warn(
                        `[Gemini] ${model} overloaded, retrying in ${delay}ms ` +
                        `(attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL})...`
                    );
                    await sleep(delay);
                } else {
                    console.warn(
                        `[Gemini] ${model} exhausted after ${MAX_RETRIES_PER_MODEL} attempts, ` +
                        `trying next model in chain...`
                    );
                }
            }
        }
    }

    // All models exhausted
    throw lastError;
}

/**
 * embedWithRetry
 *
 * Embedding models don't have a public fallback chain yet, so we keep
 * the simple retry logic (up to 3 attempts, same backoff).
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
                console.warn(
                    `[Gemini Embed] Overloaded, retrying in ${delay}ms ` +
                    `(attempt ${attempt + 1}/${EMBED_MAX_RETRIES})...`
                );
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

export default genai;
