import { describe, it, expect, vi, beforeEach } from "vitest";

// ── nodemailer mock must be declared BEFORE the route module is imported
// so the module-level `transporter = createTransport(...)` captures our spy. ─
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test" });
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data, init = {}) => ({
      _data: data,
      status: init.status || 200,
      headers: new Map(),
    }),
  },
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

vi.mock("../../lib/otp", () => ({
  isValidEmail: (e) =>
    typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()),
  isValidOtp: (o) => typeof o === "string" && /^\d{6}$/.test(o),
  isValidResetToken: (t) =>
    typeof t === "string" && /^[a-f0-9]{64}$/.test(t),
  storeOtp: vi.fn().mockResolvedValue("123456"),
  verifyOtp: vi.fn().mockResolvedValue({ success: false, code: "INVALID_OTP" }),
  storeResetToken: vi.fn().mockResolvedValue("a".repeat(64)),
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

// Mock User.exists and connectToDatabase — defaults to "user exists"
// Paths are relative to this test file (tests/routes/) to match the
// module resolution Vitest uses for vi.mock.
const mockUserExists = vi.fn().mockResolvedValue({ _id: "user-id" });
vi.mock("../../models/User", () => ({
  default: { exists: (...args) => mockUserExists(...args) },
}));
vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const { POST: sendCode } = await import(
  "../../src/app/api/auth/send-code/route"
);

// Capture how many times createTransport was invoked during module
// initialization. This must be done immediately after import, before any
// vi.clearAllMocks() call resets the counter to 0.
const createTransportCallsAtLoad = mockCreateTransport.mock.calls.length;

// Re-import storeOtp so we can spy on it in the new tests
const { storeOtp } = await import("../../lib/otp");

function makeReq(body, ip = "1.2.3.4") {
  return {
    json: async () => body,
    headers: {
      get: (h) => (h === "x-forwarded-for" ? ip : null),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Original validation tests (unchanged behaviour)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/send-code (validation only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default: user exists
    mockUserExists.mockResolvedValue({ _id: "user-id" });
    mockSendMail.mockResolvedValue({ messageId: "test" });
    storeOtp.mockResolvedValue("123456");
  });

  it("rejects missing email with 400", async () => {
    const res = await sendCode(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects malformed email with 400", async () => {
    const res = await sendCode(makeReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("accepts a valid email and returns 200", async () => {
    const res = await sendCode(makeReq({ email: "user@example.com" }));
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — new behavioral tests
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/send-code (user-existence guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeOtp.mockResolvedValue("123456");
    mockSendMail.mockResolvedValue({ messageId: "ok" });
  });

  it("existing email → OTP stored, email sent, 200 returned", async () => {
    mockUserExists.mockResolvedValue({ _id: "abc123" });

    const res = await sendCode(makeReq({ email: "registered@example.com" }));

    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(res._data.message).toBe(
      "A verification code has been sent to your email"
    );
    // storeOtp must have been called (OTP was generated and stored)
    expect(storeOtp).toHaveBeenCalledOnce();
    // SMTP must have fired
    expect(mockSendMail).toHaveBeenCalledOnce();
  });

  it("non-existing email → 200 returned with identical body, no OTP stored, sendMail NOT called", async () => {
    mockUserExists.mockResolvedValue(null);

    const res = await sendCode(makeReq({ email: "ghost@example.com" }));

    expect(res.status).toBe(200);
    // Response body must be identical to the success case
    expect(res._data.success).toBe(true);
    expect(res._data.message).toBe(
      "A verification code has been sent to your email"
    );
    // No OTP must have been generated or stored
    expect(storeOtp).not.toHaveBeenCalled();
    // SMTP must NOT have fired
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — transporter singleton test
// ─────────────────────────────────────────────────────────────────────────────
describe("nodemailer transporter singleton", () => {
  it("createTransport is called exactly once at module load, not per request", async () => {
    // The count was snapshotted right after import, before any clearAllMocks
    // could reset it. It must be exactly 1: the module-level initialization.
    expect(createTransportCallsAtLoad).toBe(1);
  });
});

