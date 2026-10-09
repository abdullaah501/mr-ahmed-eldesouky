import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry } from "../../lib/ai/core/retryPolicy";
import { AiError, AiErrorCode, isRetryableError } from "../../lib/ai/types/errors";

beforeEach(() => {
  vi.useRealTimers();
});

describe("isRetryableError", () => {
  it("treats 429 as retryable", () => {
    const err = new AiError(AiErrorCode.RATE_LIMITED, "rl");
    err.extra = { status: 429 };
    expect(isRetryableError(err)).toBe(true);
  });

  it("treats 500 as retryable", () => {
    const err = new AiError(AiErrorCode.BAD_RESPONSE, "boom");
    err.extra = { status: 500 };
    expect(isRetryableError(err)).toBe(true);
  });

  it("treats 400 as non-retryable", () => {
    const err = new AiError(AiErrorCode.BAD_RESPONSE, "bad");
    err.extra = { status: 400 };
    expect(isRetryableError(err)).toBe(false);
  });

  it("treats network errors as retryable", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns first success without retry", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const res = await withRetry(fn);
    expect(res).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable failures up to maxRetries", async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(() => {
      attempts += 1;
      if (attempts < 2) {
        const e = new Error("fetch failed");
        e.status = 500;
        throw e;
      }
      return "ok-after-retry";
    });
    const res = await withRetry(fn, { onRetry() {} });
    expect(res).toBe("ok-after-retry");
    expect(attempts).toBe(2);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockImplementation(() => {
      const e = new AiError(AiErrorCode.BAD_RESPONSE, "no");
      e.extra = { status: 400 };
      throw e;
    });
    await expect(withRetry(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After header for 429", async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(() => {
      attempts += 1;
      if (attempts < 2) {
        const e = new AiError(AiErrorCode.RATE_LIMITED, "rl");
        e.extra = { status: 429, retryAfterSeconds: 0 };
        throw e;
      }
      return "ok";
    });
    const start = Date.now();
    const res = await withRetry(fn, { onRetry() {} });
    expect(res).toBe("ok");
    expect(Date.now() - start).toBeLessThan(2000);
  });
});