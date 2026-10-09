import { describe, it, expect, vi, beforeEach } from "vitest";

// Phase 4 — sliding session lifetime via Session.expiresAt.
// Each successful refresh slides expiresAt forward by SESSION_TTL_MS; the
// MongoDB TTL index (expireAfterSeconds=0) deletes the document when it
// passes. refreshAuth also rejects a session whose expiresAt has just
// passed but not yet been swept.

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  signJWT: vi.fn().mockResolvedValue("tok"),
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
import { SESSION_TTL_MS } from "../../lib/auth/config";

const OID = "507f1f77bcf86cd799439011";
const FUTURE = () => new Date(Date.now() + 60000);
const PAST = () => new Date(Date.now() - 1000);

function seed(expiresAt = FUTURE()) {
  mocks.sessionFindOne.mockResolvedValue({
    _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt", expiresAt,
  });
  mocks.userFindById.mockResolvedValue({
    _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {},
    firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: 1,
  });
  mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
}

describe("sliding session — refreshAuth extends expiresAt on every rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
  });

  it("SL1: winning rotation stamps expiresAt ≈ now + SESSION_TTL_MS", async () => {
    seed();

    const before = Date.now();
    await refreshAuth(OID);
    const after = Date.now();

    const $set = mocks.sessionFindOneAndUpdate.mock.calls[0][1].$set;
    expect($set.expiresAt).toEqual(expect.any(Date));
    const eaMs = $set.expiresAt.getTime();
    expect(eaMs).toBeGreaterThanOrEqual(before + SESSION_TTL_MS - 50);
    expect(eaMs).toBeLessThanOrEqual(after + SESSION_TTL_MS + 50);
  });

  it("SL2: concurrent loser path does NOT modify expiresAt (winner already slid it)", async () => {
    seed();
    mocks.sessionFindOneAndUpdate.mockResolvedValue(null);
    mocks.sessionFindOne
      .mockResolvedValueOnce({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt", expiresAt: FUTURE(),
      })
      .mockResolvedValueOnce({
        _id: "s1", userId: "u1", isExp: false, expiredAt: null,
        refreshToken: "tok", previousRefreshToken: "rt",
        previousRefreshTokenExpiresAt: FUTURE(), expiresAt: FUTURE(),
      });

    await refreshAuth(OID);

    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(1);
    // Loser must not perform an updateOne at all (no DB write, just an
    // access-token sign).
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("SL3: session whose expiresAt just passed is rejected (not yet TTL-swept)", async () => {
    seed(PAST());

    const result = await refreshAuth(OID);

    expect(result.success).toBe(false);
    expect(result.newAccessToken).toBeUndefined();
    expect(mocks.sessionFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("SL4: session without expiresAt (legacy / pre-migration) is allowed through", async () => {
    // expiresAt: null simulates a doc that pre-dates the migration script
    // AND has not yet been backfilled. The TTL index will ignore it (MongoDB
    // skips docs missing the indexed field), but refreshAuth itself does not
    // reject — the rotation will stamp expiresAt forward and the document
    // becomes TTL-eligible.
    seed(null);

    const result = await refreshAuth(OID);

    expect(result.success).toBe(true);
    const $set = mocks.sessionFindOneAndUpdate.mock.calls[0][1].$set;
    expect($set.expiresAt).toEqual(expect.any(Date));
  });

  it("SL5: twenty back-to-back rotations each slide expiresAt (no premature expiry)", async () => {
    let expiresAt = FUTURE();
    mocks.sessionFindOne.mockImplementation(async () => ({
      _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt", expiresAt,
    }));
    mocks.userFindById.mockResolvedValue({
      _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {},
      firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: 1,
    });
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });

    let prevExpiry = null;
    for (let i = 0; i < 20; i++) {
      await refreshAuth(OID);
      const $set = mocks.sessionFindOneAndUpdate.mock.calls[i][1].$set;
      const ea = $set.expiresAt.getTime();
      expect(ea).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 50);
      if (prevExpiry !== null) {
        // Each rotation sets expiresAt ≈ now + TTL; not strictly monotonic
        // wall-clock, but always in the future relative to itself.
        expect(ea).toBeGreaterThan(Date.now() - 1000);
      }
      prevExpiry = ea;
      expiresAt = new Date(ea);
    }

    expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalledTimes(20);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });
});
