import { CAPABILITIES } from "./capabilities";
import { MODELS } from "./models";
import { CAPABILITY } from "../../types/capabilities";
import { AiError, AiErrorCode } from "../../types/errors";
import { resolveCapability } from "../base/BaseProviderAdapter";
import { emitAiEvent } from "../../metrics/aiMetrics";

const DEFAULT_BASE = "https://opencode.ai/api/v1/chat/completions";

function errorCodeForStatus(status) {
  if (status === 401) return AiErrorCode.PROVIDER_DISABLED;
  if (status === 402) return AiErrorCode.BUDGET_EXCEEDED;
  return AiErrorCode.BAD_RESPONSE;
}

function baseUrl() {
  const override = process.env.OPENCODE_BASE_URL;
  if (override && override.trim()) return override.replace(/\/$/, "");
  return DEFAULT_BASE;
}

function pickModel(model) {
  return model || (MODELS.find((m) => m.default) || MODELS[0]).id;
}

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function mapMessages(messages) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function extractUsage(data) {
  const u = data?.usage || {};
  return {
    promptTokens: u.prompt_tokens ?? null,
    completionTokens: u.completion_tokens ?? null,
    totalTokens: u.total_tokens ?? null,
  };
}

async function callCompletions(apiKey, body) {
  const providerId = "opencode";
  const model = body?.model || "unknown";
  const resolvedUrl = baseUrl();
  let res;
  const t0 = process.hrtime.bigint();

  const messages = body.messages || [];
  const sysMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role === "user");
  const rf = body.response_format || {};

  emitAiEvent("provider_http_request", {
    provider: providerId,
    model,
    method: "POST",
    url: resolvedUrl,
    hostname: new URL(resolvedUrl).hostname,
    path: new URL(resolvedUrl).pathname,
    temperature: body.temperature ?? null,
    maxTokens: body.max_tokens ?? null,
    stream: body.stream ?? false,
    messagesCount: messages.length,
    systemLength: sysMsg ? String(sysMsg.content || "").length : 0,
    userLength: userMsgs.reduce((sum, m) => sum + String(m.content || "").length, 0),
    toolsCount: Array.isArray(body.tools) ? body.tools.length : 0,
    toolChoice: body.tool_choice ?? null,
    responseFormatType: rf.type || null,
    jsonSchemaName: rf.json_schema?.name || null,
    jsonSchemaStrict: rf.json_schema?.strict ?? null,
  });

  try {
    res = await fetch(resolvedUrl, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify(body),
    });
  } catch (e) {
    emitAiEvent("provider_http_error", {
      provider: providerId,
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
    provider: providerId,
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
      provider: providerId,
      model,
      status: res.status,
      responseBody: text.length > 4000 ? text.slice(0, 4000) : text,
      responseBodyLength: text.length,
    });
    const code = errorCodeForStatus(res.status);
    const err = new AiError(code, `OpenCode HTTP ${res.status}: ${text.slice(0, 300)}`);
    err.extra = { status: res.status, body: text };
    throw err;
  }

  return res.json();
}

export const opencodeAdapter = {
  id: "opencode",
  label: "OpenCode",
  implemented: true,
  capabilities: CAPABILITIES,
  models: MODELS,
  baseUrl: baseUrl(),
  apiKey: () => process.env.OPENCODE_API_KEY || "",

  supports(capability, opts) {
    return resolveCapability(this, capability, opts);
  },

  async generateText({ messages, model, options = {} }) {
    const modelId = pickModel(model);
    const body = { model: modelId, messages: mapMessages(messages) };
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;

    const data = await callCompletions(this.apiKey(), body);

    return {
      provider: this.id,
      model: modelId,
      text: data?.choices?.[0]?.message?.content || "",
      usage: extractUsage(data),
      raw: data,
    };
  },

  async generateObject({ messages, schema, model, options = {} }) {
    const modelId = pickModel(model);
    const body = { model: modelId, messages: mapMessages(messages) };
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;
    if (this.supports(CAPABILITY.JSON_MODE, { model: modelId })) {
      body.response_format = { type: "json_object" };
    }

    const data = await callCompletions(this.apiKey(), body);
    const rawText = data?.choices?.[0]?.message?.content || "";
    if (!rawText.trim()) {
      throw new AiError(AiErrorCode.BAD_RESPONSE, "OpenCode returned empty response");
    }
    const parsed = parseJsonObject(rawText);
    if (!parsed.ok) {
      throw new AiError(AiErrorCode.ASSERTION_FAILED, "OpenCode returned non-JSON object", { body: rawText.slice(0, 500) });
    }

    return { provider: this.id, model: modelId, object: parsed.value, usage: extractUsage(data), raw: data };
  },

  extract(input) {
    return this.generateObject(input);
  },

  async *streamText({ messages, model, options = {} }) {
    const modelId = pickModel(model);
    const body = { model: modelId, messages: mapMessages(messages), stream: true };
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;

    const resolvedUrl = baseUrl();
    const t0 = process.hrtime.bigint();
    emitAiEvent("provider_http_request", {
      provider: "opencode",
      model: modelId,
      method: "POST",
      url: resolvedUrl,
      hostname: new URL(resolvedUrl).hostname,
      path: new URL(resolvedUrl).pathname,
    });

    const res = await fetch(resolvedUrl, {
      method: "POST",
      headers: { ...headers(this.apiKey()), Accept: "text/event-stream" },
      body: JSON.stringify(body),
    });

    emitAiEvent("provider_http_response", {
      provider: "opencode",
      model: modelId,
      status: res.status,
      ok: res.ok,
      durationMs: Math.round(Number(process.hrtime.bigint() - t0) / 1e6),
    });

    if (!res.ok || !res.body) {
      throw new AiError(AiErrorCode.BAD_RESPONSE, `OpenCode stream ${res.status}`);
    }

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
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) yield { provider: this.id, model: modelId, text: delta };
        } catch { /* skip keep-alive */ }
      }
    }
  },

  estimateCost({ usage, model }) {
    const entry = MODELS.find((m) => m.id === model) || MODELS[0];
    if (!entry?.pricing || usage == null) return null;
    if (entry.pricing.inputPer1M == null || entry.pricing.outputPer1M == null) return null;
    const inTok = usage.promptTokens ?? usage.totalTokens ?? 0;
    const outTok = usage.completionTokens ?? 0;
    const cost = (inTok / 1_000_000) * entry.pricing.inputPer1M
      + (outTok / 1_000_000) * entry.pricing.outputPer1M;
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