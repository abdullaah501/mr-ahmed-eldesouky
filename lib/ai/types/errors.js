export const AiErrorCode = {
  PLATFORM_DISABLED: "AI_PLATFORM_DISABLED",
  NO_PROVIDER: "AI_NO_PROVIDER",
  NO_CONFIGURED_PROVIDER: "AI_NO_CONFIGURED_PROVIDER",
  PROVIDER_DISABLED: "AI_PROVIDER_DISABLED",
  CAPABILITY_MISSING: "AI_CAPABILITY_MISSING",
  RATE_LIMITED: "AI_RATE_LIMITED",
  TIMEOUT: "AI_TIMEOUT",
  BAD_RESPONSE: "AI_BAD_RESPONSE",
  EXTRACTION_FAILED: "AI_EXTRACTION_FAILED",
  RESOURCE_UNSUPPORTED: "AI_RESOURCE_UNSUPPORTED",
  NOT_IMPLEMENTED: "AI_NOT_IMPLEMENTED",
  CIRCUIT_OPEN: "AI_CIRCUIT_OPEN",
  BUDGET_EXCEEDED: "AI_BUDGET_EXCEEDED",
  ASSERTION_FAILED: "AI_ASSERTION_FAILED",
  INVALID_TASK: "AI_INVALID_TASK",
  UNKNOWN_WORKFLOW: "AI_UNKNOWN_WORKFLOW",
};

export class AiError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.name = "AiError";
    this.code = code;
    this.extra = extra;
  }
}

export function isRetryableError(err) {
  if (!err) return false;
  if (err instanceof AiError && err.code === AiErrorCode.RATE_LIMITED) return true;
  const status = err.extra?.status || err.status;
  if (typeof status === "number") {
    if (status === 429) return true;
    if (status >= 500 && status < 600) return true;
  }
  const msg = String(err.message || err.code || "").toLowerCase();
  if (/timeout|timed out|econnreset|enetunreach|fetch failed|network/.test(msg)) {
    return true;
  }
  return false;
}