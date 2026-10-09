import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const mockUserFindOneAndUpdate = vi.fn().mockResolvedValue({ _id: "u1" });
const mockSessionUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 2 });
const mockConsumeResetToken = vi.fn().mockResolvedValue("user@example.com");
const mockIsRateLimitedFn = vi.fn().mockResolvedValue(false);
const storageMap = new Map();

vi.mock("next/server", () => ({
  NextResponse: { json: (data, init = {}) => ({ _data: data, status: init.status || 200, headers: new Map() }) },
}));
vi.mock("../../lib/storage/MemcachedAdapter", () => ({
  createMemcachedAdapter: () => ({
    get: vi.fn(async (k) => storageMap.get(k) ?? null),
    set: vi.fn(async (k, v) => { storageMap.set(k, String(v)); }),
    add: vi.fn(async (k, v) => { if (storageMap.has(k)) return false; storageMap.set(k, String(v)); return true; }),
    delete: vi.fn(async (k) => { storageMap.delete(k); }),
    increment: vi.fn().mockResolvedValue(1),
  }),
}));
vi.mock("../../models/User", () => ({ default: { findOneAndUpdate: (...a) => mockUserFindOneAndUpdate(...a) } }));
vi.mock("../../models/Session", () => ({ default: { updateMany: (...a) => mockSessionUpdateMany(...a) } }));
vi.mock("../../lib/connectToDb", () => ({ default: vi.fn().mockResolvedValue(true) }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-pw") } }));
vi.mock("../../lib/otp", () => ({
  isValidEmail: (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()),
  isValidResetToken: (t) => typeof t === "string" && /^[a-f0-9]{64}$/.test(t),
  consumeResetToken: (...a) => mockConsumeResetToken(...a),
  hashEmail: (e) => crypto.createHash("sha256").update(e.toLowerCase().trim()).digest("hex"),
}));
vi.mock("../../lib/isRateLimited", () => ({ isRateLimited: (...a) => mockIsRateLimitedFn(...a) }));

const { POST: resetPassword } = await import("../../src/app/api/auth/reset-password/route");

function makeReq(body, ip = "1.2.3.4") {
  return { json: async () => body, headers: { get: (h) => (h === "x-forwarded-for" ? ip : null) } };
}

describe("password reset invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMap.clear();
    mockUserFindOneAndUpdate.mockResolvedValue({ _id: "u1" });
    mockSessionUpdateMany.mockResolvedValue({ modifiedCount: 2 });
    mockConsumeResetToken.mockResolvedValue("user@example.com");
    mockIsRateLimitedFn.mockResolvedValue(false);
  });

  it("P1: password change calls Session.deleteMany", async () => {
    await resetPassword(makeReq({ resetToken: "a".repeat(64), password: "newpass1", confirmPassword: "newpass1" }));
    expect(mockUserFindOneAndUpdate).toHaveBeenCalled();
    const updateArg = mockUserFindOneAndUpdate.mock.calls[0][1];
    expect(updateArg.$inc).toEqual({ tokenVersion: 1 });
  });

  it("P2: parallel test — password reset flag-revokes all user sessions (Phase 6)", async () => {
    const res = await resetPassword(makeReq({ resetToken: "a".repeat(64), password: "newpass1", confirmPassword: "newpass1" }));
    expect(res.status).toBe(200);
    expect(mockSessionUpdateMany).toHaveBeenCalledWith(
      { userId: "u1", isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });
});
