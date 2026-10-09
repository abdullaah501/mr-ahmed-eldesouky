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
const FUTURE = () => new Date(Date.now() + 30000);
const PAST = () => new Date(Date.now() - 1000);

function seedInitial() {
  mocks.sessionFindOne.mockResolvedValue({
    _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "old.rt",
  });
  mocks.userFindById.mockResolvedValue({
    _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {},
    firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: 1,
  });
  mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
}

// CAS fails + re-read returns `rereadDoc` (the state another concurrent
// request left behind).
function seedLoserScenario(rereadDoc) {
  mocks.sessionFindOneAndUpdate.mockResolvedValue(null);
  mocks.sessionFindOne
    .mockResolvedValueOnce({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "old.rt" })
    .mockResolvedValueOnce(rereadDoc);
}

describe("refresh rotation — grace window (Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
    mocks.signJWT.mockResolvedValue("new.access.token.signed");
    seedInitial();
  });

  it("GW1: winning rotation records the predecessor token + grace expiry", async () => {
    const result = await refreshAuth(OID);

    expect(result.success).toBe(true);
    const $set = mocks.sessionFindOneAndUpdate.mock.calls[0][1].$set;
    expect($set.refreshToken).toBe("new.access.token.signed");
    expect($set.previousRefreshToken).toBe("old.rt");
    expect($set.previousRefreshTokenExpiresAt).toEqual(expect.any(Date));
    const graceMs = $set.previousRefreshTokenExpiresAt.getTime() - Date.now();
    expect(graceMs).toBeGreaterThan(25000);
    expect(graceMs).toBeLessThanOrEqual(30000);
  });

  it("GW2: concurrent loser (predecessor inside grace) succeeds WITHOUT rotating or revoking", async () => {
    seedLoserScenario({
      _id: "s1", userId: "u1", isExp: false, expiredAt: null,
      refreshToken: "winner.rt", previousRefreshToken: "old.rt",
      previousRefreshTokenExpiresAt: FUTURE(),
    });

    const result = await refreshAuth(OID);

    expect(result.success).toBe(true);
    expect(result.newAccessToken).toBeDefined();
    // No second rotation attempt beyond the loser's own failed CAS
    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(1);
    // No revocation
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("GW3: predecessor AFTER grace expiry is a genuine replay → revoke", async () => {
    seedLoserScenario({
      _id: "s1", userId: "u1", isExp: false, expiredAt: null,
      refreshToken: "winner.rt", previousRefreshToken: "old.rt",
      previousRefreshTokenExpiresAt: PAST(),
    });

    const result = await refreshAuth(OID);

    expect(result.success).toBe(false);
    expect(result.newAccessToken).toBeUndefined();
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("GW4: unknown predecessor token is a genuine replay → revoke", async () => {
    seedLoserScenario({
      _id: "s1", userId: "u1", isExp: false, expiredAt: null,
      refreshToken: "winner.rt", previousRefreshToken: "unrelated.rt",
      previousRefreshTokenExpiresAt: FUTURE(),
    });

    const result = await refreshAuth(OID);

    expect(result.success).toBe(false);
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("GW5: CAS failure with UNCHANGED current token (transient race) succeeds without rotation", async () => {
    seedLoserScenario({
      _id: "s1", userId: "u1", isExp: false, expiredAt: null,
      refreshToken: "old.rt", previousRefreshToken: "ancient.rt",
      previousRefreshTokenExpiresAt: PAST(),
    });

    const result = await refreshAuth(OID);

    expect(result.success).toBe(true);
    expect(result.newAccessToken).toBeDefined();
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("GW6: revoked re-read state (isExp=true) fails without a second revoke write", async () => {
    seedLoserScenario({
      _id: "s1", userId: "u1", isExp: true, expiredAt: new Date(),
      refreshToken: "winner.rt", previousRefreshToken: "old.rt",
      previousRefreshTokenExpiresAt: FUTURE(),
    });

    const result = await refreshAuth(OID);

    expect(result.success).toBe(false);
    // updateOne may still be issued but the isExp:{$ne:true} filter no-ops
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("GW7: AUTH_GRACE_WINDOW_MS=0 disables the grace path (rollback flag → old behavior)", async () => {
    vi.stubEnv("AUTH_GRACE_WINDOW_MS", "0");
    vi.resetModules();

    const configValues = await import("../../lib/auth/config");
    expect(configValues.REFRESH_GRACE_WINDOW_MS).toBe(0);

    const { refreshAuth: refreshAuthNoGrace } = await import("../../lib/refreshAuth");
    // Winner records an already-expired predecessor (now + 0ms)
    const winner = await refreshAuthNoGrace(OID);
    expect(winner.success).toBe(true);
    const $set = mocks.sessionFindOneAndUpdate.mock.calls[0][1].$set;
    expect($set.previousRefreshTokenExpiresAt.getTime()).toBeLessThanOrEqual(Date.now());

    // A concurrent loser presenting that predecessor is now revoked (pre-Phase-2
    // behavior): with grace=0 the winner records an already-expired predecessor.
    seedLoserScenario({
      _id: "s1", userId: "u1", isExp: false, expiredAt: null,
      refreshToken: "winner.rt", previousRefreshToken: "old.rt",
      previousRefreshTokenExpiresAt: PAST(),
    });
    mocks.sessionFindOneAndUpdate.mockResolvedValue(null);

    const loser = await refreshAuthNoGrace(OID);
    expect(loser.success).toBe(false);
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
