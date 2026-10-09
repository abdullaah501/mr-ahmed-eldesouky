import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data, init = {}) => ({
      _data: data,
      status: init.status || 200,
      headers: new Map(),
    }),
  },
}));

const mockUserFindOneAndUpdate = vi.fn();
const mockSessionUpdateMany = vi.fn();
const mockConsumeResetToken = vi.fn();
const mockIsRateLimitedFn = vi.fn();
const storageMap = new Map();

vi.mock("../../lib/storage/MemcachedAdapter", () => ({
  createMemcachedAdapter: () => ({
    get: vi.fn(async (key) => storageMap.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      storageMap.set(key, String(value));
    }),
    add: vi.fn(async (key, value) => {
      if (storageMap.has(key)) return false;
      storageMap.set(key, String(value));
      return true;
    }),
    delete: vi.fn(async (key) => {
      storageMap.delete(key);
    }),
    increment: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock("../../models/User", () => ({
  default: {
    findOneAndUpdate: (...args) => mockUserFindOneAndUpdate(...args),
  },
}));

vi.mock("../../models/Session", () => ({
  default: {
    updateMany: (...args) => mockSessionUpdateMany(...args),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue(true),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-pw"),
  },
}));

vi.mock("../../lib/otp", () => ({
  isValidEmail: (e) =>
    typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()),
  isValidOtp: (o) => typeof o === "string" && /^\d{6}$/.test(o),
  isValidResetToken: (t) =>
    typeof t === "string" && /^[a-f0-9]{64}$/.test(t),
  storeOtp: vi.fn(),
  verifyOtp: vi.fn(),
  storeResetToken: vi.fn(),
  consumeResetToken: (...args) => mockConsumeResetToken(...args),
  hashEmail: (e) =>
    crypto.createHash("sha256").update(e.toLowerCase().trim()).digest("hex"),
  hmacOtp: vi.fn().mockReturnValue("hmac"),
}));

vi.mock("../../lib/isRateLimited", () => ({
  isRateLimited: (...args) => mockIsRateLimitedFn(...args),
}));

const { POST: resetPassword } = await import(
  "../../src/app/api/auth/reset-password/route"
);

function makeReq(body, ip = "1.2.3.4") {
  return {
    json: async () => body,
    headers: {
      get: (h) => (h === "x-forwarded-for" ? ip : null),
    },
  };
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMap.clear();
    mockUserFindOneAndUpdate.mockResolvedValue({ _id: "u1" });
    mockSessionUpdateMany.mockResolvedValue({ modifiedCount: 0 });
    mockConsumeResetToken.mockResolvedValue("user@example.com");
    mockIsRateLimitedFn.mockResolvedValue(false);
  });

  it("rejects missing fields with 400", async () => {
    const res = await resetPassword(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects malformed resetToken (not 64-char hex) with 400", async () => {
    const res = await resetPassword(
      makeReq({
        resetToken: "short",
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects password < 6 chars with 400", async () => {
    const token = "a".repeat(64);
    const res = await resetPassword(
      makeReq({ resetToken: token, password: "abc", confirmPassword: "abc" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects password mismatch with 400", async () => {
    const token = "a".repeat(64);
    const res = await resetPassword(
      makeReq({
        resetToken: token,
        password: "abcdef",
        confirmPassword: "different",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid (un-issued) resetToken with 400", async () => {
    mockConsumeResetToken.mockResolvedValue(null);
    const res = await resetPassword(
      makeReq({
        resetToken: "f".repeat(64),
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid token and flag-revokes sessions (Phase 6)", async () => {
    const res = await resetPassword(
      makeReq({
        resetToken: "a".repeat(64),
        password: "newpass1",
        confirmPassword: "newpass1",
      })
    );
    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(mockSessionUpdateMany).toHaveBeenCalledWith(
      { userId: "u1", isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("normalizes email before User.findOneAndUpdate", async () => {
    mockConsumeResetToken.mockResolvedValue("User@Example.COM");
    await resetPassword(
      makeReq({
        resetToken: "a".repeat(64),
        password: "newpass1",
        confirmPassword: "newpass1",
      })
    );
    expect(mockUserFindOneAndUpdate).toHaveBeenCalled();
    const call = mockUserFindOneAndUpdate.mock.calls[0][0];
    expect(call.email).toBe("user@example.com");
  });

  it("does NOT reveal 'user not found' (no enumeration): returns 200 even if user null", async () => {
    mockUserFindOneAndUpdate.mockResolvedValue(null);
    const res = await resetPassword(
      makeReq({
        resetToken: "a".repeat(64),
        password: "newpass1",
        confirmPassword: "newpass1",
      })
    );
    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
  });

  it("rate limit is called with hashed token, not raw token", async () => {
    const token = "a".repeat(64);
    await resetPassword(
      makeReq({
        resetToken: token,
        password: "newpass1",
        confirmPassword: "newpass1",
      })
    );
    const expectedHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    expect(mockIsRateLimitedFn).toHaveBeenCalledWith(
      expectedHash,
      "1.2.3.4"
    );
    const allCalls = mockIsRateLimitedFn.mock.calls;
    const passedRawToken = allCalls.some(
      ([key]) => typeof key === "string" && key.includes(token)
    );
    expect(passedRawToken).toBe(false);
  });

  it("session invalidation failure does not fail the request (fail-open documented)", async () => {
    mockSessionUpdateMany.mockRejectedValue(new Error("db error"));
    const res = await resetPassword(
      makeReq({
        resetToken: "a".repeat(64),
        password: "newpass1",
        confirmPassword: "newpass1",
      })
    );
    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(mockSessionUpdateMany).toHaveBeenCalled();
  });
});
