import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieHeaderStore = [];
let jsonData = null;
let jsonStatus = 200;

const NextResponse = {
  json: (data, init = {}) => {
    jsonData = data;
    jsonStatus = init.status || 200;
    return {
      headers: {
        set(name, value) { cookieHeaderStore[0] = { name, value }; },
        append(name, value) { cookieHeaderStore.push({ name, value }); },
        get(name) { return cookieHeaderStore.find((c) => c.name === name)?.value; },
      },
    };
  },
};

vi.mock("next/server", () => ({ NextResponse }));

vi.mock("cookie", () => ({
  serialize: (name, value, opts) => `${name}=${value}; Path=${opts.path}; Expires=${opts.expires ? opts.expires.toUTCString() : "none"}`,
}));

const mockSessionUpdateOne = vi.fn();
const mockIsValidObjectId = vi.fn();

vi.mock("mongoose", () => {
  const mockSchema = function () { return {}; };
  mockSchema.Types = { ObjectId: function () {} };
  return {
    default: {
      isValidObjectId: (...args) => mockIsValidObjectId(...args),
      Schema: mockSchema,
      model: () => ({}),
      models: {},
    },
    isValidObjectId: (...args) => mockIsValidObjectId(...args),
    Schema: mockSchema,
    model: () => ({}),
    models: {},
  };
});

vi.mock("../../models/Session", () => ({
  default: {
    updateOne: (...args) => mockSessionUpdateOne(...args),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue(true),
}));

const { POST: logout } = await import("../../src/app/api/auth/logout/route");

function makeReq(sessionId) {
  return {
    cookies: {
      get: (name) => (name === "s-i" && sessionId ? { value: sessionId } : undefined),
    },
  };
}

describe("POST /api/auth/logout — flag-revocation (Phase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieHeaderStore.length = 0;
    jsonData = null;
    jsonStatus = 200;
    mockIsValidObjectId.mockReturnValue(true);
    mockSessionUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("L1: logout flag-revokes the session (isExp=true) and clears both cookies", async () => {
    await logout(makeReq("507f1f77bcf86cd799439011"));
    expect(jsonData).toEqual({ success: true, message: "Logged out successfully" });
    expect(mockSessionUpdateOne).toHaveBeenCalledWith(
      { _id: "507f1f77bcf86cd799439011", isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
    const accessCookie = cookieHeaderStore.find((c) => c.value.startsWith("access_token="));
    const sICookie = cookieHeaderStore.find((c) => c.value.startsWith("s-i="));
    expect(accessCookie).toBeDefined();
    expect(accessCookie.value).toContain("Expires=Thu, 01 Jan 1970");
    expect(sICookie).toBeDefined();
    expect(sICookie.value).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("L2: logout twice — second call still returns success (idempotent)", async () => {
    mockSessionUpdateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });
    await logout(makeReq("507f1f77bcf86cd799439011"));
    await logout(makeReq("507f1f77bcf86cd799439011"));
    expect(jsonData).toEqual({ success: true, message: "Logged out successfully" });
    expect(mockSessionUpdateOne).toHaveBeenCalledTimes(2);
  });

  it("L3: logout after session already revoked — still succeeds, no re-revoke write matches", async () => {
    mockSessionUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    await logout(makeReq("507f1f77bcf86cd799439011"));
    expect(jsonData).toEqual({ success: true, message: "Logged out successfully" });
    expect(mockSessionUpdateOne).toHaveBeenCalledTimes(1);
    // The isExp:{$ne:true} filter means an already-revoked session matches
    // nothing — the update is a safe no-op rather than a second revocation.
    expect(mockSessionUpdateOne).toHaveBeenCalledWith(
      { _id: "507f1f77bcf86cd799439011", isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("L4: logout with malformed s-i cookie — no DB call, still succeeds", async () => {
    mockIsValidObjectId.mockReturnValue(false);
    await logout(makeReq("not-a-valid-objectid"));
    expect(jsonData).toEqual({ success: true, message: "Logged out successfully" });
    expect(mockSessionUpdateOne).not.toHaveBeenCalled();
    const accessCookie = cookieHeaderStore.find((c) => c.value.startsWith("access_token="));
    expect(accessCookie).toBeDefined();
  });

  it("L5: logout with no s-i cookie — no DB call, still succeeds", async () => {
    await logout(makeReq(undefined));
    expect(jsonData).toEqual({ success: true, message: "Logged out successfully" });
    expect(mockSessionUpdateOne).not.toHaveBeenCalled();
    const accessCookie = cookieHeaderStore.find((c) => c.value.startsWith("access_token="));
    expect(accessCookie).toBeDefined();
  });
});
