import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data, init = {}) => {
      const headers = new Map();
      return {
        _data: data,
        status: init.status || 200,
        headers: {
          set: (k, v) => headers.set(k, v),
          get: (k) => headers.get(k),
        },
      };
    },
  },
}));

const mockVerifyOtp = vi.fn();
const mockStoreResetToken = vi.fn().mockResolvedValue("a".repeat(64));

vi.mock("../../lib/otp", () => ({
  isValidEmail: (e) =>
    typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()),
  isValidOtp: (o) => typeof o === "string" && /^\d{6}$/.test(o),
  isValidResetToken: (t) =>
    typeof t === "string" && /^[a-f0-9]{64}$/.test(t),
  storeOtp: vi.fn(),
  verifyOtp: (...args) => mockVerifyOtp(...args),
  storeResetToken: (...args) => mockStoreResetToken(...args),
  consumeResetToken: vi.fn().mockResolvedValue("user@example.com"),
  hashEmail: vi.fn().mockReturnValue("hashed"),
  hmacOtp: vi.fn().mockReturnValue("hmac"),
}));

vi.mock("../../lib/rateLimit", () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 100,
      retryAfter: 0,
      resetAt: Date.now() + 60000,
    }),
  incrementRateLimit: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock("../../lib/storage/MemcachedAdapter", () => ({
  createMemcachedAdapter: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(false),
    increment: vi.fn().mockResolvedValue(1),
  }),
}));

const { POST: verifyCode } = await import(
  "../../src/app/api/auth/verify-code/route"
);

function makeReq(body, ip = "1.2.3.4") {
  return {
    json: async () => body,
    headers: {
      get: (h) => (h === "x-forwarded-for" ? ip : null),
    },
  };
}

describe("POST /api/auth/verify-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({ success: true });
    mockStoreResetToken.mockResolvedValue("a".repeat(64));
  });

  it("rejects missing fields with 400", async () => {
    const res = await verifyCode(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects malformed email with 400", async () => {
    const res = await verifyCode(makeReq({ email: "bad", otp: "123456" }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed OTP (5 digits) with 400", async () => {
    const res = await verifyCode(
      makeReq({ email: "user@example.com", otp: "12345" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric OTP with 400", async () => {
    const res = await verifyCode(
      makeReq({ email: "user@example.com", otp: "abcdef" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects failed verification with 400", async () => {
    mockVerifyOtp.mockResolvedValue({ success: false, code: "INVALID_OTP" });
    const res = await verifyCode(
      makeReq({ email: "user@example.com", otp: "000000" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 + resetToken on correct OTP", async () => {
    const res = await verifyCode(
      makeReq({ email: "user@example.com", otp: "123456" })
    );
    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(res._data.resetToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sets Cache-Control: no-store on success response", async () => {
    const res = await verifyCode(
      makeReq({ email: "user@example.com", otp: "123456" })
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
