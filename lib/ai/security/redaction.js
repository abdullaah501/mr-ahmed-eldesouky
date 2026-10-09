const DEFAULT_REDACT_KEYS = new Set([
  "prompt",
  "system",
  "output",
  "object",
  "text",
  "raw",
  "messages",
  "response",
  "apiKey",
  "api_key",
  "authorization",
  "key",
  "secret",
  "token",
  "password",
]);

export function redact(obj, keys = DEFAULT_REDACT_KEYS) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = keys.has(k) ? "<redacted>" : v;
  }
  return out;
}

export function redactString(text, maxLen = 0) {
  if (!text) return "";
  if (typeof text !== "string") text = String(text);
  return maxLen && text.length > maxLen ? text.slice(0, maxLen) + "<redacted>" : "<redacted>";
}

export { DEFAULT_REDACT_KEYS };