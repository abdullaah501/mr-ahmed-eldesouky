import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateOtp,
  storeOtp,
  verifyOtp,
  consumeOtp,
  getRemainingAttempts,
  storeResetToken,
  consumeResetToken,
  isValidEmail,
  isValidOtp,
  isValidResetToken,
  OTP_LENGTH,
  OTP_TTL_SECONDS,
  OTP_FENCE_TTL_SECONDS,
  MAX_ATTEMPTS,
  RESET_TOKEN_TTL_SECONDS,
  buildOtpStoreKey,
  buildOtpFenceKey,
  buildOtpAttemptsKey,
  buildOtpClaimKey,
  buildResetTokenKey,
  buildResetCurrentKey,
  hmacOtp,
  hashEmail,
} from "../lib/otp";
import { InMemoryStorage } from "./helpers/InMemoryStorage";

describe("generateOtp", () => {
  it("produces a string of OTP_LENGTH digits", () => {
    const otp = generateOtp();
    expect(otp).toHaveLength(OTP_LENGTH);
    expect(/^\d+$/.test(otp)).toBe(true);
  });

  it("produces different values on successive calls", () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(generateOtp());
    expect(seen.size).toBeGreaterThan(95);
  });

  it("accepts a custom length parameter", () => {
    const otp = generateOtp(8);
    expect(otp).toHaveLength(8);
    expect(/^\d+$/.test(otp)).toBe(true);
  });

  it("is unbiased across digits (no modulo skew)", () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 100000; i++) {
      const otp = generateOtp();
      counts[parseInt(otp[0], 10)]++;
    }
    const expected = 10000;
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.85);
      expect(c).toBeLessThan(expected * 1.15);
    }
  });
});

describe("validation helpers", () => {
  it("isValidEmail accepts standard addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("  user@example.com  ")).toBe(true);
    expect(isValidEmail("a.b+c@sub.example.co")).toBe(true);
  });

  it("isValidEmail rejects malformed inputs", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });

  it("isValidOtp accepts 6-digit strings", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("000000")).toBe(true);
    expect(isValidOtp("999999")).toBe(true);
  });

  it("isValidOtp rejects malformed inputs", () => {
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("1234567")).toBe(false);
    expect(isValidOtp("abcdef")).toBe(false);
    expect(isValidOtp("12 456")).toBe(false);
    expect(isValidOtp("")).toBe(false);
    expect(isValidOtp(null)).toBe(false);
    expect(isValidOtp(123456)).toBe(false);
  });

  it("isValidResetToken accepts 64-char hex strings", () => {
    const tok = "a".repeat(64);
    expect(isValidResetToken(tok)).toBe(true);
    const tok2 =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(isValidResetToken(tok2)).toBe(true);
  });

  it("isValidResetToken rejects malformed inputs", () => {
    expect(isValidResetToken("a".repeat(63))).toBe(false);
    expect(isValidResetToken("a".repeat(65))).toBe(false);
    expect(isValidResetToken("Z".repeat(64))).toBe(false);
    expect(isValidResetToken("")).toBe(false);
    expect(isValidResetToken(null)).toBe(false);
  });
});

describe("OTP_PEPPER is required", () => {
  it("throws if OTP_PEPPER is missing", async () => {
    const original = process.env.OTP_PEPPER;
    delete process.env.OTP_PEPPER;
    let threw = false;
    try {
      vi.resetModules();
      await import("../lib/otp.js");
    } catch (err) {
      threw = true;
      expect(err.message).toMatch(/OTP_PEPPER/);
    }
    expect(threw).toBe(true);
    if (original !== undefined) process.env.OTP_PEPPER = original;
  });

  it("throws if OTP_PEPPER is too short", async () => {
    const original = process.env.OTP_PEPPER;
    process.env.OTP_PEPPER = "short";
    let threw = false;
    try {
      vi.resetModules();
      await import("../lib/otp.js");
    } catch (err) {
      threw = true;
      expect(err.message).toMatch(/OTP_PEPPER/);
    }
    expect(threw).toBe(true);
    if (original !== undefined) process.env.OTP_PEPPER = original;
  });
});

describe("hashEmail and hmacOtp", () => {
  it("hashEmail is deterministic and case-insensitive", () => {
    expect(hashEmail("User@Example.com")).toBe(hashEmail("user@example.com"));
  });

  it("hashEmail produces 64-char hex", () => {
    expect(hashEmail("a@b.com")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hmacOtp is deterministic and different for different OTPs", () => {
    expect(hmacOtp("123456")).toBe(hmacOtp("123456"));
    expect(hmacOtp("123456")).not.toBe(hmacOtp("654321"));
  });
});

describe("key building (no raw email in keys)", () => {
  const email = "user@example.com";

  it("buildOtpStoreKey does not contain raw email", () => {
    const key = buildOtpStoreKey(email);
    expect(key).not.toContain(email);
    expect(key).not.toContain(email.toLowerCase());
    expect(key).toMatch(/^otp:store:[a-f0-9]{64}$/);
  });

  it("buildOtpFenceKey does not contain raw email", () => {
    const key = buildOtpFenceKey(email);
    expect(key).not.toContain(email);
    expect(key).toMatch(/^otp:fence:[a-f0-9]{64}$/);
  });

  it("buildOtpAttemptsKey does not contain raw email", () => {
    const key = buildOtpAttemptsKey(email);
    expect(key).not.toContain(email);
    expect(key).toMatch(/^otp:attempts:[a-f0-9]{64}$/);
  });

  it("buildOtpClaimKey does not contain raw email", () => {
    const key = buildOtpClaimKey(email, "123456");
    expect(key).not.toContain(email);
    expect(key).toMatch(/^otp:claim:[a-f0-9]{64}:[a-f0-9]{64}$/);
  });

  it("buildResetCurrentKey does not contain raw email", () => {
    const key = buildResetCurrentKey(email);
    expect(key).not.toContain(email);
    expect(key).toMatch(/^reset:current:[a-f0-9]{64}$/);
  });

  it("buildResetTokenKey is the token itself (already random)", () => {
    const tok = "a".repeat(64);
    expect(buildResetTokenKey(tok)).toBe(`reset:token:${tok}`);
  });
});

describe("storeOtp and verifyOtp", () => {
  let storage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it("stores and retrieves an OTP for verification", async () => {
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });
    expect(otp).toHaveLength(OTP_LENGTH);
    expect(typeof otp).toBe("string");

    const result = await verifyOtp({ email, otp, storageAdapter: storage });
    expect(result.success).toBe(true);
  });

  it("stores OTP as HMAC hash, never plaintext", async () => {
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });
    const storeKey = buildOtpStoreKey(email);
    const storedValue = await storage.get(storeKey);
    expect(storedValue).not.toBe(otp);
    expect(storedValue).toBe(hmacOtp(otp));
  });

  it("rejects an incorrect OTP", async () => {
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    const result = await verifyOtp({
      email,
      otp: "000000",
      storageAdapter: storage,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_OTP");
  });

  it("rejects malformed OTP (5 digits)", async () => {
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    const result = await verifyOtp({
      email,
      otp: "12345",
      storageAdapter: storage,
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed OTP (7 digits)", async () => {
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    const result = await verifyOtp({
      email,
      otp: "1234567",
      storageAdapter: storage,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric OTP", async () => {
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    const result = await verifyOtp({
      email,
      otp: "abcdef",
      storageAdapter: storage,
    });
    expect(result.success).toBe(false);
  });

  it("rejects OTP after MAX_ATTEMPTS failures", async () => {
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = await verifyOtp({
        email,
        otp: "000000",
        storageAdapter: storage,
      });
      if (i < MAX_ATTEMPTS - 1) {
        expect(result.success).toBe(false);
        expect(result.code).toBe("INVALID_OTP");
      }
    }

    const result = await verifyOtp({
      email,
      otp: "000000",
      storageAdapter: storage,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("MAX_ATTEMPTS");
  });

  it("prevents duplicate OTP storage within fence window", async () => {
    const email = "test@example.com";
    const first = await storeOtp({ email, storageAdapter: storage });
    expect(first).not.toBeNull();

    const second = await storeOtp({ email, storageAdapter: storage });
    expect(second).toBeNull();
  });

  it("allows OTP storage after fence TTL expires", async () => {
    const email = "test@example.com";
    const first = await storeOtp({ email, storageAdapter: storage });
    expect(first).not.toBeNull();

    const fenceKey = buildOtpFenceKey(email);
    storage._expiresAt.set(fenceKey, 0);

    const second = await storeOtp({ email, storageAdapter: storage });
    expect(second).not.toBeNull();
  });

  it("OTP expires after TTL", async () => {
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });
    expect(otp).not.toBeNull();

    const storeKey = buildOtpStoreKey(email);
    storage._expiresAt.set(storeKey, 0);

    const result = await verifyOtp({ email, otp, storageAdapter: storage });
    expect(result.success).toBe(false);
  });

  it("verification consumes the OTP (no replay)", async () => {
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });
    const first = await verifyOtp({ email, otp, storageAdapter: storage });
    expect(first.success).toBe(true);

    const second = await verifyOtp({ email, otp, storageAdapter: storage });
    expect(second.success).toBe(false);
  });

  it("is case-insensitive for email lookup", async () => {
    const email = "Test@Example.COM";
    const otp = await storeOtp({ email, storageAdapter: storage });
    expect(otp).not.toBeNull();

    const result = await verifyOtp({
      email: "test@example.com",
      otp,
      storageAdapter: storage,
    });
    expect(result.success).toBe(true);
  });

  it("uses timingSafeEqual (different OTP does not match)", async () => {
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });

    const result = await verifyOtp({
      email,
      otp: String((parseInt(otp, 10) + 1) % 1000000).padStart(6, "0"),
      storageAdapter: storage,
    });
    expect(result.success).toBe(false);
  });
});

describe("OTP concurrent verification (atomic claim)", () => {
  it("only one concurrent verification can succeed", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });

    const [a, b] = await Promise.all([
      verifyOtp({ email, otp, storageAdapter: storage }),
      verifyOtp({ email, otp, storageAdapter: storage }),
    ]);

    const successes = [a, b].filter((r) => r.success);
    const failures = [a, b].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].code).toBe("OTP_ALREADY_USED");
  });

  it("three concurrent verifications: only one wins", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const otp = await storeOtp({ email, storageAdapter: storage });

    const results = await Promise.all([
      verifyOtp({ email, otp, storageAdapter: storage }),
      verifyOtp({ email, otp, storageAdapter: storage }),
      verifyOtp({ email, otp, storageAdapter: storage }),
    ]);

    const successes = results.filter((r) => r.success);
    expect(successes).toHaveLength(1);
  });
});

describe("concurrent OTP regeneration (atomic fence)", () => {
  it("only one of two parallel storeOtp calls succeeds", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";

    const [a, b] = await Promise.all([
      storeOtp({ email, storageAdapter: storage }),
      storeOtp({ email, storageAdapter: storage }),
    ]);

    const nonNull = [a, b].filter((r) => r !== null);
    const nulls = [a, b].filter((r) => r === null);
    expect(nonNull).toHaveLength(1);
    expect(nulls).toHaveLength(1);
  });
});

describe("consumeOtp", () => {
  it("deletes the OTP, attempts, and fence keys", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    await consumeOtp({ email, storageAdapter: storage });

    expect(await storage.get(buildOtpStoreKey(email))).toBeNull();
    expect(await storage.get(buildOtpAttemptsKey(email))).toBeNull();
    expect(await storage.get(buildOtpFenceKey(email))).toBeNull();
  });
});

describe("getRemainingAttempts", () => {
  it("returns MAX_ATTEMPTS when no attempts made", async () => {
    const storage = new InMemoryStorage();
    const remaining = await getRemainingAttempts({
      email: "test@example.com",
      storageAdapter: storage,
    });
    expect(remaining).toBe(MAX_ATTEMPTS);
  });

  it("decreases after failed verifications", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    await storeOtp({ email, storageAdapter: storage });

    await verifyOtp({
      email,
      otp: "000000",
      storageAdapter: storage,
    });
    const remaining = await getRemainingAttempts({
      email,
      storageAdapter: storage,
    });
    expect(remaining).toBe(MAX_ATTEMPTS - 1);
  });
});

describe("resetToken lifecycle", () => {
  it("stores and consumes a reset token", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const token = await storeResetToken({
      email,
      storageAdapter: storage,
    });
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const retrievedEmail = await consumeResetToken({
      token,
      storageAdapter: storage,
    });
    expect(retrievedEmail).toBe(email);
  });

  it("returns null for invalid token", async () => {
    const storage = new InMemoryStorage();
    const result = await consumeResetToken({
      token: "a".repeat(64),
      storageAdapter: storage,
    });
    expect(result).toBeNull();
  });

  it("can only consume a token once (single-use)", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const token = await storeResetToken({
      email,
      storageAdapter: storage,
    });

    await consumeResetToken({ token, storageAdapter: storage });

    const result = await consumeResetToken({
      token,
      storageAdapter: storage,
    });
    expect(result).toBeNull();
  });

  it("invalidates previous token when a new one is issued", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const t1 = await storeResetToken({
      email,
      storageAdapter: storage,
    });
    const t2 = await storeResetToken({
      email,
      storageAdapter: storage,
    });
    expect(t1).not.toBe(t2);

    const r1 = await consumeResetToken({ token: t1, storageAdapter: storage });
    expect(r1).toBeNull();
  });
});

describe("resetToken concurrent consumption (atomic claim)", () => {
  it("only one of two parallel consume calls succeeds", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const token = await storeResetToken({
      email,
      storageAdapter: storage,
    });

    const [a, b] = await Promise.all([
      consumeResetToken({ token, storageAdapter: storage }),
      consumeResetToken({ token, storageAdapter: storage }),
    ]);

    const nonNull = [a, b].filter((r) => r !== null);
    expect(nonNull).toHaveLength(1);
    expect(nonNull[0]).toBe(email);
  });

  it("three parallel consumes: only one wins", async () => {
    const storage = new InMemoryStorage();
    const email = "test@example.com";
    const token = await storeResetToken({
      email,
      storageAdapter: storage,
    });

    const results = await Promise.all([
      consumeResetToken({ token, storageAdapter: storage }),
      consumeResetToken({ token, storageAdapter: storage }),
      consumeResetToken({ token, storageAdapter: storage }),
    ]);

    const nonNull = results.filter((r) => r !== null);
    expect(nonNull).toHaveLength(1);
  });
});
