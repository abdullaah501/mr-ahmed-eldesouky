import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  signJWT: vi.fn().mockResolvedValue("new.access.token.signed"),
  sessionFindOne: vi.fn(),
  sessionFindOneAndUpdate: vi.fn().mockResolvedValue({ _id: "ok" }),
  sessionUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  userFindById: vi.fn(),
  connectToDb: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../../lib/jwt", () => ({ verifyJWT: (...a) => mocks.verifyJWT(...a), signJWT: (...a) => mocks.signJWT(...a) }));
vi.mock("../../lib/connectToDb", () => ({ default: (...a) => mocks.connectToDb(...a) }));
vi.mock("../../models/Session", () => ({
  default: {
    findOne: () => ({ select: () => ({ lean: (...a) => mocks.sessionFindOne(...a) }) }),
    findOneAndUpdate: (...a) => mocks.sessionFindOneAndUpdate(...a),
    updateOne: (...a) => mocks.sessionUpdateOne(...a),
  },
}));
vi.mock("../../models/User", () => ({
  default: { findById: () => ({ select: () => ({ lean: (...a) => mocks.userFindById(...a) }) }) },
}));

import { refreshAuth } from "../../lib/refreshAuth";

const OID = "507f1f77bcf86cd799439011";

describe("refresh rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
    mocks.signJWT.mockResolvedValue("new.access.token.signed");
    mocks.sessionFindOne.mockReset();
    mocks.userFindById.mockReset();
    mocks.verifyJWT.mockReset();
  });

  function seed() {
    mocks.sessionFindOne.mockResolvedValue({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "old.rt" });
    mocks.userFindById.mockResolvedValue({ _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: 1 });
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
  }

  it("R1: new refresh token generated on success", async () => {
    seed();
    const result = await refreshAuth(OID);
    expect(result.success).toBe(true);
    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: OID, refreshToken: "old.rt" }),
      expect.objectContaining({ $set: expect.objectContaining({ refreshToken: expect.any(String) }) }),
      { new: true }
    );
    expect(mocks.signJWT).toHaveBeenCalledTimes(2);
    const refreshCall = mocks.signJWT.mock.calls.find((c) => c[1] === "7d");
    expect(refreshCall).toBeDefined();
  });

  it("R2: old refresh token is rejected after rotation (replay)", async () => {
    seed();
    mocks.sessionFindOneAndUpdate.mockResolvedValue(null);
    // Re-read: DB holds an unrelated current token whose predecessor is NOT
    // the token this caller expected → genuine replay / stale read.
    mocks.sessionFindOne
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "old.rt" })
      .mockResolvedValueOnce({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "current.rt", previousRefreshToken: "some.older.rt",
        previousRefreshTokenExpiresAt: new Date(Date.now() + 30000),
      });
    const result = await refreshAuth(OID);
    expect(result.success).toBe(false);
    expect(mocks.signJWT).toHaveBeenCalledTimes(1);
    expect(mocks.signJWT.mock.calls[0][1]).toBe("7d");
  });

  it("R3: replay attempt triggers session revocation (isExp=true)", async () => {
    seed();
    mocks.sessionFindOneAndUpdate.mockResolvedValue(null);
    mocks.sessionFindOne
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "old.rt" })
      .mockResolvedValueOnce({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "current.rt", previousRefreshToken: "some.older.rt",
        previousRefreshTokenExpiresAt: new Date(Date.now() + 30000),
      });
    await refreshAuth(OID);
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("R4: genuine replay does not issue a new access token", async () => {
    seed();
    mocks.sessionFindOneAndUpdate.mockResolvedValue(null);
    mocks.sessionFindOne
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "old.rt" })
      .mockResolvedValueOnce({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "current.rt", previousRefreshToken: "some.older.rt",
        previousRefreshTokenExpiresAt: new Date(Date.now() + 30000),
      });
    const result = await refreshAuth(OID);
    expect(result.success).toBe(false);
    expect(result.newAccessToken).toBeUndefined();
  });
});
