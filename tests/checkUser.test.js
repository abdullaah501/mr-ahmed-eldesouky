import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  signJWT: vi.fn().mockResolvedValue("new.access.token.signed"),
  sessionFindOne: vi.fn(),
  sessionFindOneAndUpdate: vi.fn().mockResolvedValue({ _id: "ok" }),
  sessionUpdateOne: vi.fn(),
  userFindById: vi.fn(),
  connectToDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/jwt", () => ({
  verifyJWT: (...args) => mocks.verifyJWT(...args),
  signJWT: (...args) => mocks.signJWT(...args),
}));

vi.mock("../models/Session", () => ({
  default: {
    findOne: () => ({
      select: () => ({
        lean: (...args) => mocks.sessionFindOne(...args),
      }),
    }),
    findOneAndUpdate: (...args) => mocks.sessionFindOneAndUpdate(...args),
    updateOne: (...args) => mocks.sessionUpdateOne(...args),
  },
}));

vi.mock("../models/User", () => ({
  default: {
    findById: () => ({
      select: () => ({
        lean: (...args) => mocks.userFindById(...args),
      }),
    }),
  },
}));

vi.mock("../lib/connectToDb", () => ({
  default: (...args) => mocks.connectToDatabase(...args),
}));

import { cookies } from "next/headers";
import checkUser from "../lib/checkUser";

function setCookies(map) {
  cookies.mockResolvedValue({
    get: (name) => (map[name] !== undefined ? { value: map[name] } : undefined),
  });
}

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";
const USER_OBJECT_ID = "507f1f77bcf86cd799439022";

function seedSession({ sessionId = VALID_OBJECT_ID, userId = USER_OBJECT_ID, isExp = false, expiredAt = null, refreshToken = "valid.refresh.jwt" } = {}) {
  mocks.sessionFindOne.mockResolvedValue({ _id: sessionId, userId, isExp, expiredAt, refreshToken });
}

function seedUser({ _id = USER_OBJECT_ID, role = "student", email = "user@example.com", firstName = "User", lastName = "Test", tokenVersion = 1 } = {}) {
  mocks.userFindById.mockResolvedValue({
    _id,
    role,
    email,
    grade: "grade-1",
    image: { url: "u", cloudId: "c" },
    firstName,
    lastName,
    phone: "123",
    guardianPhone: "456",
    governorate: "Cairo",
    tokenVersion,
  });
}

describe("checkUser — access token fast path", () => {
  beforeEach(() => {
    mocks.verifyJWT.mockReset();
    mocks.signJWT.mockClear();
    mocks.sessionFindOne.mockReset();
    mocks.sessionFindOneAndUpdate.mockClear();
    mocks.userFindById.mockReset();
    mocks.connectToDatabase.mockClear();
  });

  it("T1: valid access token authenticates with ZERO database queries", async () => {
    setCookies({ access_token: "valid.jwt" });
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", role: "admin", email: "a@b.com" });

    const result = await checkUser();

    expect(result.success).toBe(true);
    expect(result.user.role).toBe("admin");
    expect(result.newAccessToken).toBeUndefined();
    expect(mocks.verifyJWT).toHaveBeenCalledTimes(1);
    expect(mocks.connectToDatabase).not.toHaveBeenCalled();
    expect(mocks.sessionFindOne).not.toHaveBeenCalled();
    expect(mocks.userFindById).not.toHaveBeenCalled();
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("T2: expired access token + valid refresh falls through to refresh flow", async () => {
    setCookies({ access_token: "expired.jwt", "s-i": VALID_OBJECT_ID });
    mocks.verifyJWT
      .mockRejectedValueOnce(new Error("expired"))
      .mockResolvedValueOnce({ _id: USER_OBJECT_ID, role: "admin", tokenVersion: 1 });
    seedSession();
    seedUser({ role: "student" });

    const result = await checkUser();

    expect(result.success).toBe(true);
    expect(result.user.role).toBe("student");
    expect(result.newAccessToken).toBe("new.access.token.signed");
    expect(mocks.verifyJWT).toHaveBeenCalledTimes(2);
    expect(mocks.sessionFindOne).toHaveBeenCalledTimes(1);
    expect(mocks.userFindById).toHaveBeenCalledTimes(1);
  });

  it("T3: invalid (tampered) access token falls through to refresh flow", async () => {
    setCookies({ access_token: "tampered.jwt", "s-i": VALID_OBJECT_ID });
    mocks.verifyJWT
      .mockRejectedValueOnce(new Error("bad signature"))
      .mockResolvedValueOnce({ _id: USER_OBJECT_ID, role: "admin", tokenVersion: 1 });
    seedSession();
    seedUser();

    const result = await checkUser();

    expect(result.success).toBe(true);
    expect(result.newAccessToken).toBe("new.access.token.signed");
  });

  it("T4: missing cookies returns failure with no DB calls and no exceptions", async () => {
    setCookies({});
    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
    expect(mocks.connectToDatabase).not.toHaveBeenCalled();
    expect(mocks.sessionFindOne).not.toHaveBeenCalled();
    expect(mocks.userFindById).not.toHaveBeenCalled();
  });
});

describe("checkUser — refresh path defenses", () => {
  beforeEach(() => {
    mocks.verifyJWT.mockReset();
    mocks.signJWT.mockClear();
    mocks.sessionFindOne.mockReset();
    mocks.sessionFindOneAndUpdate.mockClear();
    mocks.userFindById.mockReset();
    mocks.connectToDatabase.mockClear();
  });

  it("T5: malformed ObjectId cookie returns failure WITHOUT CastError or DB call", async () => {
    setCookies({ "s-i": "not-a-valid-objectid" });
    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
    expect(mocks.sessionFindOne).not.toHaveBeenCalled();
    expect(mocks.userFindById).not.toHaveBeenCalled();
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("T6: session not found returns failure", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    mocks.sessionFindOne.mockResolvedValue(null);
    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
  });

  it("T7: revoked session (isExp=true) returns failure; refresh JWT is NEVER verified", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession({ isExp: true });
    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
    expect(mocks.verifyJWT).toHaveBeenCalledTimes(0);
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("T8: expired session (expiredAt in past) returns failure; refresh JWT is NEVER verified", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession({ expiredAt: new Date(Date.now() - 1000) });
    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
    expect(mocks.verifyJWT).toHaveBeenCalledTimes(0);
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("T9: deleted user returns failure; no new access token signed", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession();
    mocks.userFindById.mockResolvedValue(null);

    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("T10: demoted admin — DB role wins over stale JWT role", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession();
    seedUser({ role: "student" });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, role: "admin", tokenVersion: 1 });

    const result = await checkUser();
    expect(result.success).toBe(true);
    expect(result.user.role).toBe("student");
    expect(mocks.signJWT).toHaveBeenCalledTimes(2);
    const accessTokenCall = mocks.signJWT.mock.calls.find((c) => c[1] === "30m");
    expect(accessTokenCall).toBeDefined();
    const signedPayload = accessTokenCall[0];
    expect(signedPayload.role).toBe("student");
  });

  it("T11: email changed in DB — fresh email returned (not from JWT)", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession();
    seedUser({ email: "new@example.com" });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, email: "stale@example.com", tokenVersion: 1 });

    const result = await checkUser();
    expect(result.user.email).toBe("new@example.com");
  });

  it("T12: image changed in DB — fresh image returned", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession();
    mocks.userFindById.mockResolvedValue({
      _id: USER_OBJECT_ID,
      role: "student",
      email: "u@e.com",
      grade: "g",
      image: { url: "https://new", cloudId: "new-cloud-id" },
      firstName: "F",
      lastName: "L",
      phone: "1",
      guardianPhone: "2",
      governorate: "G",
      tokenVersion: 1,
    });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, image: { url: "stale" }, tokenVersion: 1 });

    const result = await checkUser();
    expect(result.user.image).toEqual({ url: "https://new", cloudId: "new-cloud-id" });
  });

  it("T13: stale refresh JWT claiming role:'admin' cannot elevate after demotion", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession();
    seedUser({ role: "student" });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, role: "admin", tokenVersion: 1 });

    const result = await checkUser();
    expect(result.user.role).toBe("student");
    const accessTokenCall = mocks.signJWT.mock.calls.find((c) => c[1] === "30m");
    const signedPayload = accessTokenCall[0];
    expect(signedPayload.role).not.toBe("admin");
  });

  it("T14: JWT/session _id mismatch (decoded._id !== session.userId) returns failure", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedSession({ userId: USER_OBJECT_ID });
    mocks.verifyJWT.mockResolvedValue({ _id: "507f1f77bcf86cd799439099" });

    const result = await checkUser();
    expect(result).toEqual({ success: false, message: "User not authenticated" });
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("T15: concurrent refresh — both succeed via grace window; exactly ONE rotation; no revocation", async () => {
    setCookies({ "s-i": VALID_OBJECT_ID });
    seedUser({ role: "assistant" });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, role: "admin", tokenVersion: 1 });

    // Winner's CAS succeeds; loser's fails and re-reads the rotated session.
    mocks.sessionFindOneAndUpdate
      .mockResolvedValueOnce({ _id: "first" })
      .mockResolvedValueOnce(null);
    mocks.sessionFindOne
      .mockResolvedValueOnce({
        _id: VALID_OBJECT_ID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: "valid.refresh.jwt",
        expiresAt: null,
      })
      .mockResolvedValueOnce({
        _id: VALID_OBJECT_ID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: "valid.refresh.jwt",
        expiresAt: null,
      })
      .mockResolvedValue({
        _id: VALID_OBJECT_ID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: "new.access.token.signed",
        previousRefreshToken: "valid.refresh.jwt",
        previousRefreshTokenExpiresAt: new Date(Date.now() + 30000),
        expiresAt: null,
      });

    const [a, b] = await Promise.all([checkUser(), checkUser()]);

    // Both callers authenticate (pre-Phase-2: the loser was revoked → forced logout)
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(a.user.role).toBe("assistant");
    expect(b.user.role).toBe("assistant");

    // Exactly one rotation, zero revocations
    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });
});
