// Google Gemini integration (REST, no extra SDK needed).
// Asks for structured JSON and validates it before returning.
import { config } from '../config/env.js';
import { notConfigured, upstream, AppError } from '../lib/errors.js';
import { GEMINI_RESPONSE_SCHEMA, aiResultSchema } from './schema.js';
import { systemInstruction, userMessage } from './prompts.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Low-level call. `fetchImpl` lets tests pass a fake fetch.
export async function callGemini({ system, user, fetchImpl = fetch }) {
  if (!config.gemini.apiKey) throw notConfigured('Gemini (GEMINI_API_KEY)');

  const url = `${API_BASE}/${encodeURIComponent(config.gemini.model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.gemini.timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      // Key goes in a header, not the URL, so it never shows up in logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw upstream('Gemini', 'request timed out', 504);
    throw upstream('Gemini', 'network error');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    // 429 = quota / rate limit. Pass it through so the app can tell the user to wait.
    throw upstream('Gemini', msg, res.status === 429 ? 429 : 502);
  }

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) {
    const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || 'empty response';
    throw upstream('Gemini', `no content (${reason})`);
  }
  return { text, usage: data.usageMetadata || null };
}

// Turns raw text into a validated result. Handles ```json fences just in case.
export function parseAiResult(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let json;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AppError(502, 'ai_bad_json', 'Gemini returned invalid JSON. Try again.');
  }
  const parsed = aiResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(502, 'ai_bad_shape', 'Gemini JSON did not match the file-operation schema.', parsed.error.issues);
  }
  return parsed.data;
}

// High-level: prompt + stack + files -> plan, explanation, operations
export async function generateCode({ prompt, stacks, files, history = [], fetchImpl }) {
  const { text, usage } = await callGemini({
    system: systemInstruction(stacks),
    user: userMessage({ prompt, files, history }),
    fetchImpl,
  });
  return { ...parseAiResult(text), usage, model: config.gemini.model };
}
