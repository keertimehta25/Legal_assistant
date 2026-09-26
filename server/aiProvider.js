/**
 * aiProvider.js
 *
 * Unified AI provider with cross-provider fallback chain:
 *   1. gemini-3.1-flash-lite  (primary)
 *   2. gemini-3.5-flash-lite  (Gemini fallback)
 *   3. gpt-5.6-terra          (OpenAI fallback — only if OPENAI_API_KEY is set)
 *
 * OpenAI is OPTIONAL: if OPENAI_API_KEY is missing, the client is never
 * constructed and the OpenAI entry is dropped from the chain, so the server
 * runs fine Gemini-only instead of crashing on startup.
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

if (!openai) {
    console.info('[AI] OPENAI_API_KEY not set — running Gemini-only (no cross-provider fallback).');
}

const FULL_PROVIDER_CHAIN = [
    { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
    { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
    { provider: 'openai', model: 'gpt-5.6-terra' },
];

// Drop OpenAI entirely if no key is configured — avoids attempting (and
// failing) a call we already know will error on missing credentials.
const PROVIDER_CHAIN = FULL_PROVIDER_CHAIN.filter(
    (t) => t.provider !== 'openai' || openai !== null
);

const MAX_RETRIES = 2;
const BACKOFF_MS = [1000, 2000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Transient errors -> retry, then fall through to the next provider. */
function isRetryable(err) {
    const msg = String(err?.message || err);
    const status = err?.status ?? err?.response?.status;
    return (
        status === 503 || status === 429 || status === 404 ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('503') ||
        msg.includes('429') ||
        msg.includes('overloaded') ||
        msg.includes('high demand') ||
        msg.includes('rate limit') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('no longer available') ||
        msg.includes('MAX_TOKENS')
    );
}

/** Model doesn't exist / was retired -> skip retries, fall through immediately. */
function isModelNotFound(err) {
    const msg = String(err?.message || err);
    const status = err?.status ?? err?.response?.status;
    return (
        status === 404 ||
        msg.includes('NOT_FOUND') ||
        msg.includes('no longer available') ||
        msg.includes('is not found')
    );
}

/** Billing/quota exhausted -> retrying will never help, skip straight to next provider. */
function isQuotaExceeded(err) {
    const msg = String(err?.message || err).toLowerCase();
    return msg.includes('credit') || msg.includes('insufficient_quota') || msg.includes('billing');
}

async function callModel(target, prompt, jsonSchema) {
    if (target.provider === 'gemini') {
        const params = { model: target.model, contents: prompt };
        params.config = { maxOutputTokens: 16384 };
        if (jsonSchema) {
            params.config.responseMimeType = 'application/json';
            params.config.responseSchema = jsonSchema;
        }
        const res = await gemini.models.generateContent(params);

        const finishReason = res.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
            throw new Error(
                'MAX_TOKENS: The response was cut off before it finished. This usually happens with very long or very detailed documents.'
            );
        }

        return res.text;
    }

    if (target.provider === 'openai') {
        if (!openai) throw new Error('OpenAI provider requested but OPENAI_API_KEY is not configured.');
        const params = {
            model: target.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 16384,
        };
        if (jsonSchema) {
            params.response_format = { type: 'json_object' };
        }
        const res = await openai.chat.completions.create(params);
        return res.choices[0].message.content;
    }

    throw new Error(`Unknown provider: ${target.provider}`);
}

/**
 * generateWithFallback
 *
 * Tries each entry in PROVIDER_CHAIN in order. Each model gets MAX_RETRIES
 * attempts with exponential backoff on retryable errors. Model-not-found and
 * quota-exceeded errors skip retries and fall through immediately. Non-retryable
 * errors (auth, bad request) throw immediately without trying other providers.
 *
 * @param {string} prompt
 * @param {object|null} jsonSchema  Optional Gemini-style response schema.
 * @returns {Promise<string>}
 */
export async function generateWithFallback(prompt, jsonSchema = null) {
    if (PROVIDER_CHAIN.length === 0) {
        throw new Error('No AI providers are configured. Set GEMINI_API_KEY (and optionally OPENAI_API_KEY).');
    }

    let lastError;

    for (const target of PROVIDER_CHAIN) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const result = await callModel(target, prompt, jsonSchema);
                const label = `${target.provider}:${target.model}`;
                if (target !== PROVIDER_CHAIN[0]) {
                    console.info(`[AI] Used fallback - ${label}`);
                }
                return result;
            } catch (err) {
                lastError = err;

                if (isModelNotFound(err) || isQuotaExceeded(err)) {
                    console.warn(
                        `[AI] ${target.provider}:${target.model} unavailable (${isQuotaExceeded(err) ? 'quota' : 'not found'
                        }) - falling through to next provider...`
                    );
                    break;
                }

                if (!isRetryable(err)) {
                    console.warn(`[AI] Non-retryable error from ${target.provider}:${target.model}:`, err?.message || err, '- falling through to next provider...');
                    break;
                }

                if (attempt < MAX_RETRIES - 1) {
                    const delay = BACKOFF_MS[attempt];
                    console.warn(
                        `[AI] ${target.provider}:${target.model} overloaded, retrying in ${delay}ms ` +
                        `(attempt ${attempt + 1}/${MAX_RETRIES})...`
                    );
                    await sleep(delay);
                } else {
                    console.warn(
                        `[AI] ${target.provider}:${target.model} exhausted after ${MAX_RETRIES} attempts - ` +
                        `falling through to next provider...`
                    );
                }
            }
        }
    }

    throw lastError;
}
