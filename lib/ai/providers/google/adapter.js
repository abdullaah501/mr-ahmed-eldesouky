import { CAPABILITIES } from "./capabilities";
import { MODELS } from "./models";
import { AiError, AiErrorCode } from "../../types/errors";
import { resolveCapability } from "../base/BaseProviderAdapter";
import { emitAiEvent } from "../../metrics/aiMetrics";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function errorCodeForStatus(status) {
  if (status === 401) return AiErrorCode.PROVIDER_DISABLED;
  if (status === 402) return AiErrorCode.BUDGET_EXCEEDED;
  return AiErrorCode.BAD_RESPONSE;
}

function pickModel(model) {
  return model || (MODELS.find((m) => m.default) || MODELS[0]).id;
}

function apiKey() {
  return process.env.GOOGLE_AI_API_KEY || "";
}

function toBase64(buffer) {
  if (!buffer) return "";
  if (Buffer.isBuffer(buffer)) return buffer.toString("base64");
  if (buffer instanceof Uint8Array) return Buffer.from(buffer).toString("base64");
  if (typeof buffer === "string") return buffer;
  return Buffer.from(buffer).toString("base64");
}

function buildContents(messages, fileParts) {
  const contents = [];
  for (const m of messages || []) {
    const role = m.role === "assistant" || m.role === "model" ? "model" : "user";
    const parts = [];
    if (m.content) parts.push({ text: m.content });
    if (fileParts && role === "user") parts.push(...fileParts);
    if (parts.length) contents.push({ role, parts });
  }
  return contents;
}

function buildFileParts(files) {
  if (!files || !files.length) return [];
  return files.map((f) => {
    if (f.fileData) return { fileData: f.fileData };
    return {
      inlineData: {
        mimeType: f.mimeType || f.mimetype || "application/octet-stream",
        data: toBase64(f.buffer || f.data),
      },
    };
  });
}

// Provider-native "no thinking" control, applied ONLY for a catalog model
// explicitly marked reasoningControl === "google_thinking_budget". The final
// catalog ships every model UNMARKED because thinkingBudget is a 2.x-only
// field: 3.x models reject it with HTTP 400. An unmarked or unrecognized
// control value is inert (nothing is sent); unmarked models degrade
// gracefully to the AI Assist guard + anti-reasoning prompt rule.
// includeThoughts is never set. Mutates the body and emits the authoritative
// metadata-only platform event AFTER the body has actually been modified;
// `control` reports the catalog value found (null = unmarked) and `applied`
// is true iff the request body was actually modified.
function applyGoogleThinkingConfig(body, modelId) {
  const entry = MODELS.find((m) => m.id === modelId);
  const control = entry?.reasoningControl ?? null;
  const applied = control === "google_thinking_budget";
  if (applied) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  emitAiEvent("provider_reasoning_control", {
    provider: "google",
    model: modelId,
    control,
    applied,
  });
  return applied;
}

function extractUsage(data) {
  const u = data?.usageMetadata || {};
  return {
    promptTokens: u.promptTokenCount ?? null,
    completionTokens: u.candidatesTokenCount ?? null,
    totalTokens: u.totalTokenCount ?? null,
  };
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
}

async function callGemini(model, method, body, { sse = false } = {}) {
  const url = sse
    ? `${BASE}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey()}`
    : `${BASE}/models/${model}:${method}?key=${apiKey()}`;

  const t0 = process.hrtime.bigint();

  const contents = body.contents || [];
  const parts = contents.flatMap((c) => c.parts || []);
  const textParts = parts.filter((p) => typeof p.text === "string");
  const systemParts = body.systemInstruction?.parts || [];
  const gc = body.generationConfig || {};

  emitAiEvent("provider_http_request", {
    provider: "google",
    model,
    method: "POST",
    url,
    hostname: new URL(url).hostname,
    path: new URL(url).pathname,
    temperature: gc.temperature ?? null,
    maxTokens: gc.maxOutputTokens ?? null,
    stream: sse,
    messagesCount: contents.length,
    systemLength: systemParts.reduce((sum, p) => sum + String(p.text || "").length, 0),
    userLength: textParts.reduce((sum, p) => sum + String(p.text || "").length, 0),
    responseFormatType: gc.responseMimeType || null,
    jsonSchemaName: gc.responseSchema?.name || null,
    jsonSchemaStrict: gc.responseSchema?.strict ?? null,
  });

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey(), ...(sse ? { Accept: "text/event-stream" } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    emitAiEvent("provider_http_error", {
      provider: "google",
      model,
      errorName: e.name || "Error",
      errorMessage: e.message || "fetch failed",
      durationMs: Math.round(Number(process.hrtime.bigint() - t0) / 1e6),
    });
    const err = new AiError(AiErrorCode.BAD_RESPONSE, e.message || "fetch failed");
    err.extra = { status: 0 };
    throw err;
  }

  emitAiEvent("provider_http_response", {
    provider: "google",
    model,
    status: res.status,
    ok: res.ok,
    durationMs: Math.round(Number(process.hrtime.bigint() - t0) / 1e6),
  });

  if (res.status === 429) {
    const err = new AiError(AiErrorCode.RATE_LIMITED, "Rate limited");
    const retryAfter = res.headers.get("retry-after");
    err.extra = { status: 429, retryAfterSeconds: retryAfter ? Number(retryAfter) : null };
    throw err;
  }
  if (!res.ok) {
    let text = "";
    try { text = await res.text(); } catch { /* ignore */ }
    emitAiEvent("provider_http_error_body", {
      provider: "google",
      model,
      status: res.status,
      responseBody: text.length > 4000 ? text.slice(0, 4000) : text,
      responseBodyLength: text.length,
    });
    const code = errorCodeForStatus(res.status);
    const err = new AiError(code, `Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
    err.extra = { status: res.status };
    throw err;
  }
  return sse ? res : res.json();
}

export const googleAdapter = {
  id: "google",
  label: "Google Gemini",
  implemented: true,
  capabilities: CAPABILITIES,
  models: MODELS,
  baseUrl: BASE,
  apiKey: () => process.env.GOOGLE_AI_API_KEY || "",

  supports(capability, opts) {
    return resolveCapability(this, capability, opts);
  },

  async generateText({ messages, model, options = {}, files } = {}) {
    const modelId = pickModel(model);
    const body = {
      contents: buildContents(messages, buildFileParts(files)),
      generationConfig: {},
    };
    if (options.system) body.systemInstruction = { parts: [{ text: options.system }] };
    if (options.temperature != null) body.generationConfig.temperature = options.temperature;
    if (options.maxTokens != null) body.generationConfig.maxOutputTokens = options.maxTokens;
    applyGoogleThinkingConfig(body, modelId);

    const data = await callGemini(modelId, "generateContent", body);
    return { provider: this.id, model: modelId, text: extractText(data), usage: extractUsage(data), raw: data };
  },

  async generateObject({ messages, model, schema, options = {}, files } = {}) {
    const modelId = pickModel(model);
    const body = {
      contents: buildContents(messages, buildFileParts(files)),
      generationConfig: { responseMimeType: "application/json" },
    };
    if (schema) body.generationConfig.responseSchema = schema;
    if (options.system) body.systemInstruction = { parts: [{ text: options.system }] };
    if (options.temperature != null) body.generationConfig.temperature = options.temperature;
    if (options.maxTokens != null) body.generationConfig.maxOutputTokens = options.maxTokens;
    applyGoogleThinkingConfig(body, modelId);

    const data = await callGemini(modelId, "generateContent", body);
    const rawText = extractText(data);
    const parsed = parseJsonObject(rawText);
    if (!parsed.ok) {
      throw new AiError(AiErrorCode.ASSERTION_FAILED, "Gemini returned non-JSON object", { body: rawText.slice(0, 500) });
    }
    return { provider: this.id, model: modelId, object: parsed.value, usage: extractUsage(data), raw: data };
  },

  extract(input) {
    return this.generateObject(input);
  },

  async *streamText({ messages, model, options = {}, files } = {}) {
    const modelId = pickModel(model);
    const body = {
      contents: buildContents(messages, buildFileParts(files)),
      generationConfig: {},
    };
    if (options.system) body.systemInstruction = { parts: [{ text: options.system }] };
    if (options.temperature != null) body.generationConfig.temperature = options.temperature;
    if (options.maxTokens != null) body.generationConfig.maxOutputTokens = options.maxTokens;
    applyGoogleThinkingConfig(body, modelId);

    const res = await callGemini(modelId, "streamGenerateContent", body, { sse: true });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          const json = JSON.parse(payload);
          const parts = json?.candidates?.[0]?.content?.parts || [];
          const text = parts.map((p) => p.text || "").join("");
          if (text) yield { provider: this.id, model: modelId, text };
        } catch { /* skip */ }
      }
    }
  },

  estimateCost({ usage, model }) {
    const entry = MODELS.find((m) => m.id === model) || MODELS[0];
    if (!entry?.pricing || usage == null) return null;
    const inTok = usage.promptTokens ?? usage.totalTokens ?? 0;
    const outTok = usage.completionTokens ?? 0;
    const cost = (inTok / 1_000_000) * (entry.pricing.inputPer1M ?? 0)
      + (outTok / 1_000_000) * (entry.pricing.outputPer1M ?? 0);
    return Number.isFinite(cost) ? cost : null;
  },

  countTokens({ text }) {
    return Math.ceil(String(text || "").length / 4);
  },
};

function parseJsonObject(text) {
  if (!text) return { ok: false };
  const cleaned = stripAndParse(text);
  if (cleaned != null && typeof cleaned === "object") {
    return { ok: true, value: cleaned };
  }
  return { ok: false };
}

function stripAndParse(text) {
  const trimmed = String(text).trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { /* fall through */ }
  }
  return null;
}