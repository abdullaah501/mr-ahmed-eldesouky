import { AI_DEFAULTS } from "../config/defaults";
import { isRetryableError, AiError, AiErrorCode } from "../types/errors";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt) {
  const cfg = AI_DEFAULTS;
  const base = Math.min(cfg.backoffInitialMs * 2 ** attempt, cfg.backoffMaxMs);
  const jitter = Math.floor(Math.random() * cfg.jitterMaxMs);
  return base + jitter;
}

export async function withRetry(fn, { onRetry } = {}) {
  const max = AI_DEFAULTS.maxRetries;
  let attempt = 0;
  let lastErr;
  while (attempt <= max) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;

      if (!isRetryableError(err) || attempt >= max) throw err;

      let wait = backoffMs(attempt);
      if (err instanceof AiError && err.code === AiErrorCode.RATE_LIMITED) {
        if (err.extra?.retryAfterSeconds) {
          wait = Math.max(wait, err.extra.retryAfterSeconds * 1000);
        }
      }

      if (typeof onRetry === "function") {
        try { onRetry({ attempt: attempt + 1, wait, err }); } catch { /* ignore */ }
      }
      await sleep(wait);
      attempt += 1;
    }
  }
  throw lastErr;
}