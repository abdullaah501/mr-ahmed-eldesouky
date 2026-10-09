/**
 * concurrency.test.js
 *
 * Proves that the three fixed race conditions cannot be triggered:
 *
 * 1. Parallel invalid OTP attempts cannot bypass MAX_ATTEMPTS.
 * 2. Parallel send-code requests cannot bypass the IP rate limit.
 * 3. Parallel verify-code requests cannot bypass the IP rate limit.
 * 4. Window rollover under heavy concurrency initializes exactly once.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  storeOtp,
  verifyOtp,
  MAX_ATTEMPTS,
} from "../lib/otp";
import { InMemoryStorage } from "./helpers/InMemoryStorage";

// De-networked: rate limiting is exercised against an InMemoryStorage-backed
// adapter instead of the real MemCachier service (the previous live calls
// caused ECONNRESET flakes). The factory mock preserves the exact
// createMemcachedAdapter() contract that lib/rateLimit consumes.
const storageHolder = vi.hoisted(() => ({ storage: null }));

vi.mock("../lib/storage/MemcachedAdapter", () => ({
  createMemcachedAdapter: () => ({
    get: (key) => storageHolder.storage.get(key),
    set: (key, value, options) => storageHolder.storage.set(key, value, options),
    add: (key, value, options) => storageHolder.storage.add(key, value, options),
    increment: (key, amount, options) =>
      storageHolder.storage.increment(key, amount, options),
    delete: (key) => storageHolder.storage.delete(key),
  }),
}));

// ---------------------------------------------------------------------------
// 1. Parallel invalid OTP attempts cannot bypass MAX_ATTEMPTS
// ---------------------------------------------------------------------------
describe("OTP attempt counter race (fix verification)", () => {
  it("concurrent flood of wrong OTPs never exceeds MAX_ATTEMPTS successful increments", async () => {
    const storage = new InMemoryStorage();
    const email = "race@example.com";
    await storeOtp({ email, storageAdapter: storage });

    // Fire 3× MAX_ATTEMPTS concurrent bad attempts in parallel.
    const flood = Array.from({ length: MAX_ATTEMPTS * 3 }, () =>
      verifyOtp({ email, otp: "000000", storageAdapter: storage })
    );
    const results = await Promise.all(flood);

    const maxAttemptsResults = results.filter(
      (r) => r.code === "MAX_ATTEMPTS"
    );
    const invalidOtpResults = results.filter(
      (r) => r.code === "INVALID_OTP"
    );

    // All results must be failures (wrong OTP / max attempts)
    expect(results.every((r) => !r.success)).toBe(true);

    // Exactly MAX_ATTEMPTS attempts should have been granted (got INVALID_OTP
    // as the failure reason); the rest must be rejected as MAX_ATTEMPTS.
    expect(invalidOtpResults).toHaveLength(MAX_ATTEMPTS);
    expect(maxAttemptsResults).toHaveLength(MAX_ATTEMPTS * 3 - MAX_ATTEMPTS);
  });

  it("the correct OTP cannot be verified after MAX_ATTEMPTS parallel wrong attempts", async () => {
    const storage = new InMemoryStorage();
    const email = "race2@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });

    // Exhaust all attempts with bad OTPs concurrently.
    const wrongAttempts = Array.from({ length: MAX_ATTEMPTS }, () =>
      verifyOtp({ email, otp: "000000", storageAdapter: storage })
    );
    await Promise.all(wrongAttempts);

    // Now try the correct OTP — it must be blocked.
    const result = await verifyOtp({ email, otp, storageAdapter: storage });
    expect(result.success).toBe(false);
    expect(result.code).toBe("MAX_ATTEMPTS");
  });
});

// ---------------------------------------------------------------------------
// Helpers for rate-limit concurrency tests.
// The rate limiter uses a module-level storage singleton, so we test
// checkRateLimit directly using the imported module (which resolves against
// the same InMemoryStorage-backed singleton via the mocked adapter factory).
//
// For isolation we create a unique service key per test so tests don't bleed.
// ---------------------------------------------------------------------------

let rlModule;

beforeEach(async () => {
  storageHolder.storage = new InMemoryStorage();
  if (!rlModule) {
    rlModule = await import("../lib/rateLimit");
  }
});

function uniqueKey() {
  return `test-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// 2. Parallel send-code requests cannot bypass the IP rate limit
// ---------------------------------------------------------------------------
describe("Rate limit: parallel send-code cannot bypass IP limit", () => {
  it("exactly `limit` parallel requests are allowed; the rest are rejected", async () => {
    const { checkRateLimit } = rlModule;
    const limit = 5;
    const key = uniqueKey();

    const results = await Promise.all(
      Array.from({ length: limit * 3 }, () =>
        checkRateLimit({
          service: "send-code-concurrency-test",
          key,
          limit,
          windowSeconds: 60,
        })
      )
    );

    const allowed = results.filter((r) => r.allowed);
    const blocked = results.filter((r) => !r.allowed);

    expect(allowed).toHaveLength(limit);
    expect(blocked).toHaveLength(limit * 3 - limit);
  });
});

// ---------------------------------------------------------------------------
// 3. Parallel verify-code requests cannot bypass the IP rate limit
// ---------------------------------------------------------------------------
describe("Rate limit: parallel verify-code cannot bypass IP limit", () => {
  it("exactly `limit` parallel requests are allowed; the rest are rejected", async () => {
    const { checkRateLimit } = rlModule;
    const limit = 10;
    const key = uniqueKey();

    const results = await Promise.all(
      Array.from({ length: limit * 2 }, () =>
        checkRateLimit({
          service: "verify-code-concurrency-test",
          key,
          limit,
          windowSeconds: 60,
        })
      )
    );

    const allowed = results.filter((r) => r.allowed);
    const blocked = results.filter((r) => !r.allowed);

    expect(allowed).toHaveLength(limit);
    expect(blocked).toHaveLength(limit * 2 - limit);
  });
});

// ---------------------------------------------------------------------------
// 4. Window rollover under heavy concurrency initializes exactly once
// ---------------------------------------------------------------------------
describe("Rate limit: window rollover initializes exactly once under concurrency", () => {
  it("count is strictly monotonic — no request gets the same slot number", async () => {
    const { checkRateLimit } = rlModule;
    const limit = 50;
    const key = uniqueKey();

    const results = await Promise.all(
      Array.from({ length: limit }, () =>
        checkRateLimit({
          service: "window-rollover-test",
          key,
          limit,
          windowSeconds: 60,
        })
      )
    );

    const counts = results.map((r) => r.count).filter(Boolean);

    // Every request that got a count must have gotten a unique one.
    const uniqueCounts = new Set(counts);
    expect(uniqueCounts.size).toBe(counts.length);

    // The maximum count must equal the number of requests (no resets to 1).
    const maxCount = Math.max(...counts);
    expect(maxCount).toBe(limit);
  });
});
