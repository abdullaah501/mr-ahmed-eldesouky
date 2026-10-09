import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  signJWT: vi.fn().mockResolvedValue("tok"),
  sessionFindOne: vi.fn(),
  sessionFindOneAndUpdate: vi.fn().mockResolvedValue({ _id: "ok" }),
  sessionUpdateOne: vi.fn(),
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

const FUTURE = () => new Date(Date.now() + 30000);

function seed() {
  mocks.sessionFindOne.mockResolvedValue({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" });
  mocks.userFindById.mockResolvedValue({ _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: 1 });
  mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
}

describe("concurrent refresh (Phase 2 grace-window semantics)", () => {
  beforeEach(() => { vi.clearAllMocks(); seed(); });

  it("C1: two concurrent refreshes — BOTH succeed; exactly ONE rotation", async () => {
    // Winner signs "tok" as the new refresh token; loser re-reads the rotated state.
    mocks.sessionFindOneAndUpdate
      .mockResolvedValueOnce({ _id: "s1" })
      .mockResolvedValueOnce(null);
    mocks.sessionFindOne
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" })
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" })
      .mockResolvedValue({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "tok", previousRefreshToken: "rt", previousRefreshTokenExpiresAt: FUTURE(),
      });

    const [a, b] = await Promise.all([refreshAuth(OID), refreshAuth(OID)]);

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("C2: loser receives a new access token WITHOUT rotating again and WITHOUT revocation", async () => {
    mocks.sessionFindOneAndUpdate
      .mockResolvedValueOnce({ _id: "s1" })
      .mockResolvedValueOnce(null);
    mocks.sessionFindOne
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" })
      .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" })
      .mockResolvedValue({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "tok", previousRefreshToken: "rt", previousRefreshTokenExpiresAt: FUTURE(),
      });

    const [a, b] = await Promise.all([refreshAuth(OID), refreshAuth(OID)]);
    const loser = a.success && a.newAccessToken ? b : a;

    expect(loser.success).toBe(true);
    expect(loser.newAccessToken).toBeDefined();
    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("C3: twenty concurrent refreshes — one rotation, zero revocations, all succeed", async () => {
    // Winner wins the single CAS; every other caller reads "rt", fails CAS,
    // and re-reads the winner's rotated state inside the grace window.
    mocks.sessionFindOneAndUpdate.mockImplementation(async () => {
      // First caller wins; subsequent CAS attempts all miss.
      if (mocks.sessionFindOneAndUpdate.mock.calls.length === 1) return { _id: "s1" };
      return null;
    });
    let initialReads = 0;
    mocks.sessionFindOne.mockImplementation(async () => {
      // Initial reads happen before the winner commits (return "rt"); the
      // losers' re-reads happen after (return rotated state).
      if (initialReads < 20) {
        initialReads++;
        return { _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" };
      }
      return {
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "tok", previousRefreshToken: "rt", previousRefreshTokenExpiresAt: FUTURE(),
      };
    });

    const results = await Promise.all(Array.from({ length: 20 }, () => refreshAuth(OID)));

    expect(results.filter((r) => r.success)).toHaveLength(20);
    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(20);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });
});
