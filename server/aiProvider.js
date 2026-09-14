/**
 * aiProvider.js
 *
 * Unified AI provider with cross-provider fallback chain:
 *   1. gemini-2.5-flash      (primary)
 *   2. gemini-2.5-flash-lite (Gemini fallback)
 *   3. gpt-5.6-terra         (OpenAI fallback — for resilience during Gemini outages)
 *
 * Each model gets up to MAX_RETRIES attempts with exponential backoff
 * before the chain moves to the next entry.
 * Only 503 (UNAVAILABLE) and 429 (rate limit) errors trigger fallthrough.
 * All other errors throw immediately.
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Provider chain ────────────────────────────────────────────────────────────
// Priority: high-RPD Gemini lite models first (500/day each),
// then OpenAI as final fallback if both Gemini entries are overloaded.
const PROVIDER_CHAIN = [
    { provider: 'gemini', model: 'gemini-3.1-flash-lite' },   // 500 RPD
    { provider: 'gemini', model: 'gemini-3.5-flash-lite' },   // 500 RPD
    { provider: 'openai', model: 'gpt-5.6-terra'         },   // OpenAI fallback
];

const MAX_RETRIES    = 2;          // attempts per model before falling through
const BACKOFF_MS     = [1000, 2000]; // delay before attempt 2, attempt 3

// ─── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns true for transient overload/rate-limit errors → retry + fall-through.
 * Returns false for hard errors (auth, bad request, etc.) → throw immediately.
 * 404 (model not found) is treated as fall-through-only (no retry on same model).
 */
function isRetryable(err) {
    const msg    = String(err?.message || err);
    const status = err?.status ?? err?.response?.status;
    return (
        status === 503 || status === 429 || status === 404 ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('503')         ||
        msg.includes('429')         ||
        msg.includes('overloaded')  ||
        msg.includes('high demand') ||
        msg.includes('rate limit')  ||
        msg.includes('NOT_FOUND')   ||
        msg.includes('no longer available')
    );
}

/**
 * 404 / model-not-found errors: don't retry the same model, just fall through.
 */
function isModelNotFound(err) {
    const msg    = String(err?.message || err);
    const status = err?.status ?? err?.response?.status;
    return (
        status === 404 ||
        msg.includes('NOT_FOUND') ||
        msg.includes('no longer available') ||
        msg.includes('is not found')
    );
}

// ─── Per-provider call ─────────────────────────────────────────────────────────
/**
 * @param {{ provider: string, model: string }} target
 * @param {string}      prompt      Full prompt text
 * @param {object|null} jsonSchema  Gemini responseSchema object (optional)
 *                                  When provided to OpenAI the schema is
 *                                  described in the prompt instead.
 * @returns {Promise<string>} Raw text / JSON string from the model
 */
async function callModel(target, prompt, jsonSchema) {
    if (target.provider === 'gemini') {
        const params = {
            model:    target.model,
            contents: prompt,
        };
        if (jsonSchema) {
            params.config = {
                responseMimeType: 'application/json',
                responseSchema:   jsonSchema,
            };
        }
        const res = await gemini.models.generateContent(params);
        return res.text;
    }

    if (target.provider === 'openai') {
        const params = {
            model:    target.model,
            messages: [{ role: 'user', content: prompt }],
        };
        if (jsonSchema) {
            // OpenAI JSON mode: schema described in prompt, response forced to JSON
            params.response_format = { type: 'json_object' };
        }
        const res = await openai.chat.completions.create(params);
        return res.choices[0].message.content;
    }

    throw new Error(`Unknown provider: ${target.provider}`);
}

// ─── Public API ────────────────────────────────────────────────────────────────
/**
 * generateWithFallback
 *
 * Tries each entry in PROVIDER_CHAIN. Each model gets MAX_RETRIES attempts
 * with exponential backoff on retryable errors (503/429). Non-retryable errors
 * throw immediately. If a model's retries are exhausted it falls through to
 * the next entry. If the entire chain is exhausted the last error is thrown.
 *
 * @param {string}      prompt      The full prompt to send
 * @param {object|null} jsonSchema  Optional Gemini-style response schema
 * @returns {Promise<string>}       Model output as a string
 */
export async function generateWithFallback(prompt, jsonSchema = null) {
    let lastError;

    for (const target of PROVIDER_CHAIN) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const result = await callModel(target, prompt, jsonSchema);
                // Log which model was actually used (useful for debugging)
                const label = `${target.provider}:${target.model}`;
                if (target !== PROVIDER_CHAIN[0]) {
                    console.info(`[AI] Used fallback — ${label}`);
                }
                return result;
            } catch (err) {
                lastError = err;

                // Model not found — skip retries for this model, fall through immediately
                if (isModelNotFound(err)) {
                    console.warn(
                        `[AI] ${target.provider}:${target.model} not available — ` +
                        `falling through to next provider...`
                    );
                    break; // break out of retry loop, continue PROVIDER_CHAIN
                }

                if (!isRetryable(err)) {
                    // Hard failure (auth error, invalid request, etc.) — don't retry
                    console.error(`[AI] Non-retryable error from ${target.provider}:${target.model}:`, err?.message || err);
                    throw err;
                }

                if (attempt < MAX_RETRIES - 1) {
                    const delay = BACKOFF_MS[attempt];
                    console.warn(
                        `[AI] ${target.provider}:${target.model} overloaded, ` +
                        `retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`
                    );
                    await sleep(delay);
                } else {
                    console.warn(
                        `[AI] ${target.provider}:${target.model} exhausted after ` +
                        `${MAX_RETRIES} attempts — falling through to next provider...`
                    );
                }
            }
        }
    }

    // Every provider in the chain failed
    throw lastError;
}
