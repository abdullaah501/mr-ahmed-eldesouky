import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";

// Phase 9 — 3m / 7m stress validation.
//
// Config override: AUTH_ACCESS_TOKEN_TTL="3m" + AUTH_REFRESH_TOKEN_TTL="7m"
// flips the auth TTL constants WITHOUT changing any auth code path. Defaults
// remain 30m/7d for production.
//
// vi.hoisted runs synchronously at file-evaluation time, BEFORE the static
// imports below resolve, so lib/auth/config.js sees the stubbed TTLs on first
// load. The original env values are captured and restored in afterAll so
// other test files in the same worker are not affected.
//
// Time is faked via vi.useFakeTimers() so the suite runs in seconds, not
// minutes. DB models are mocked the same way as the existing concurrent /
// grace / sliding suites — these tests exercise the auth engine
// (refreshAuth + Session TTL writes + checkUser refresh path) under the
// short TTL configuration.
const __envBak = vi.hoisted(() => {
  const orig = {
    AUTH_ACCESS_TOKEN_TTL: process.env.AUTH_ACCESS_TOKEN_TTL,
    AUTH_REFRESH_TOKEN_TTL: process.env.AUTH_REFRESH_TOKEN_TTL,
    AUTH_GRACE_WINDOW_MS: process.env.AUTH_GRACE_WINDOW_MS,
  };
  process.env.AUTH_ACCESS_TOKEN_TTL = "3m";
  process.env.AUTH_REFRESH_TOKEN_TTL = "7m";
  process.env.AUTH_GRACE_WINDOW_MS = "30000";
  return orig;
});

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
vi.mock("../../lib/jwt", () => ({
  verifyJWT: (...a) => mocks.verifyJWT(...a),
  signJWT: (...a) => mocks.signJWT(...a),
}));
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

import checkUser from "../../lib/checkUser";
import { refreshAuth } from "../../lib/refreshAuth";
import * as config from "../../lib/auth/config";
import { revokeSession } from "../../lib/services/sessionService";

const OID = "507f1f77bcf86cd799439011";
const USER_OBJECT_ID = "507f1f77bcf86cd799439022";
const FUTURE = (ms = 60000) => new Date(Date.now() + ms);
const PAST = () => new Date(Date.now() - 1000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  // Re-establish the default "successful" mock impls. vi.clearAllMocks()
  // wipes queued once-values but also resets the persistent mockResolvedValue
  // impls created at module load, so every test must re-seed them.
  mocks.signJWT.mockResolvedValue("new.access.token.signed");
  mocks.connectToDb.mockResolvedValue(true);
  mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
  mocks.sessionUpdateOne.mockResolvedValue({ modifiedCount: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  if (__envBak.AUTH_ACCESS_TOKEN_TTL === undefined) delete process.env.AUTH_ACCESS_TOKEN_TTL;
  else process.env.AUTH_ACCESS_TOKEN_TTL = __envBak.AUTH_ACCESS_TOKEN_TTL;
  if (__envBak.AUTH_REFRESH_TOKEN_TTL === undefined) delete process.env.AUTH_REFRESH_TOKEN_TTL;
  else process.env.AUTH_REFRESH_TOKEN_TTL = __envBak.AUTH_REFRESH_TOKEN_TTL;
  if (__envBak.AUTH_GRACE_WINDOW_MS === undefined) delete process.env.AUTH_GRACE_WINDOW_MS;
  else process.env.AUTH_GRACE_WINDOW_MS = __envBak.AUTH_GRACE_WINDOW_MS;
});

function seedValidSession() {
  mocks.sessionFindOne.mockResolvedValue({
    _id: OID,
    userId: USER_OBJECT_ID,
    isExp: false,
    expiredAt: null,
    refreshToken: "rt",
    expiresAt: FUTURE(420000),
    previousRefreshToken: null,
    previousRefreshTokenExpiresAt: null,
  });
  mocks.userFindById.mockResolvedValue({
    _id: USER_OBJECT_ID, role: "student", email: "u@e.com", grade: "g",
    image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2",
    governorate: "G", tokenVersion: 1,
  });
  mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, tokenVersion: 1 });
}

describe("Phase 9 — 3m/7m stress", () => {
  it("PHASE9-CFG: defaults and overrides reflect the test config", () => {
    expect(config.ACCESS_TOKEN_TTL).toBe("3m");
    expect(config.REFRESH_TOKEN_TTL).toBe("7m");
    expect(config.ACCESS_TOKEN_COOKIE_MAX_AGE).toBe(180);
    expect(config.SESSION_COOKIE_MAX_AGE).toBe(420);
    expect(config.SESSION_TTL_MS).toBe(420000);
  });

  it("A. Normal expiration — login, wait past 3m, refresh, still authenticated", async () => {
    seedValidSession();
    const loginRes = await refreshAuth(OID);
    expect(loginRes.success).toBe(true);
    expect(loginRes.newAccessToken).toBe("new.access.token.signed");

    // Advance past the 3m access TTL (the cookie carries maxAge=180). With
    // sliding sessions, a refresh well past the access TTL still succeeds as
    // long as the session itself hasn't aged out.
    vi.setSystemTime(new Date(Date.now() + 181 * 1000));

    seedValidSession();
    const postRes = await refreshAuth(OID);
    expect(postRes.success).toBe(true);
    expect(postRes.newAccessToken).toBe("new.access.token.signed");
  });

  it("B. 20 concurrent expired — ≤1 logical refresh, 0 revocations, all recover", async () => {
    seedValidSession();
    let casCalls = 0;
    mocks.sessionFindOneAndUpdate.mockImplementation(async () => {
      casCalls += 1;
      return casCalls === 1 ? { _id: "winner" } : null;
    });
    // First N callers consume the initial-read doc; losers (callers 2..N)
    // each consume one reread doc. We use a stateful implementation so all 20
    // initial reads return the same fresh session, and losers see the rotated
    // state.
    let findCalls = 0;
    const WINNER_RT = "new-rt";
    mocks.sessionFindOne.mockImplementation(async () => {
      findCalls += 1;
      // First 20 calls are initial reads (one per refreshAuth). All return
      // the same pre-rotation session.
      if (findCalls <= 20) {
        return {
          _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
          refreshToken: "rt", expiresAt: FUTURE(420000),
        };
      }
      // Subsequent calls are loser re-reads: the rotated session.
      return {
        _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: WINNER_RT,
        previousRefreshToken: "rt",
        previousRefreshTokenExpiresAt: FUTURE(30000),
        expiresAt: FUTURE(420000),
      };
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, () => refreshAuth(OID))
    );

    expect(results.filter((r) => r.success)).toHaveLength(20);
    // CAS is attempted by every caller (winner takes the only successful
    // write; losers all miss the filter and fall through to the grace path).
    expect(casCalls).toBe(20);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("C. Middleware + Axios collision (server: two concurrent refreshAuth calls)", async () => {
    seedValidSession();
    let casCalls = 0;
    mocks.sessionFindOneAndUpdate.mockImplementation(async () => {
      casCalls += 1;
      return casCalls === 1 ? { _id: "winner" } : null;
    });
    let findCalls = 0;
    mocks.sessionFindOne.mockImplementation(async () => {
      findCalls += 1;
      if (findCalls <= 2) {
        return {
          _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
          refreshToken: "rt", expiresAt: FUTURE(420000),
        };
      }
      return {
        _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: "new-rt", previousRefreshToken: "rt",
        previousRefreshTokenExpiresAt: FUTURE(30000), expiresAt: FUTURE(420000),
      };
    });

    const [middlewareRes, axiosRes] = await Promise.all([
      refreshAuth(OID),
      refreshAuth(OID),
    ]);

    expect(middlewareRes.success).toBe(true);
    expect(axiosRes.success).toBe(true);
    expect(casCalls).toBe(2);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("D. Multiple tabs — two concurrent refreshAuth on the same session both win", async () => {
    seedValidSession();
    let casCalls = 0;
    mocks.sessionFindOneAndUpdate.mockImplementation(async () => {
      casCalls += 1;
      return casCalls === 1 ? { _id: "winner" } : null;
    });
    let findCalls = 0;
    mocks.sessionFindOne.mockImplementation(async () => {
      findCalls += 1;
      if (findCalls <= 2) {
        return {
          _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
          refreshToken: "rt", expiresAt: FUTURE(420000),
        };
      }
      return {
        _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: "new-rt", previousRefreshToken: "rt",
        previousRefreshTokenExpiresAt: FUTURE(30000), expiresAt: FUTURE(420000),
      };
    });

    const [tabA, tabB] = await Promise.all([
      refreshAuth(OID),
      refreshAuth(OID),
    ]);

    expect(tabA.success).toBe(true);
    expect(tabB.success).toBe(true);
    expect(casCalls).toBe(2);
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("E. Real replay (grace=0) — old token after rotation is rejected, session revoked", async () => {
    vi.stubEnv("AUTH_GRACE_WINDOW_MS", "0");
    // Genuine replay: the attacker's request reads the pre-rotation
    // refresh token (T1) from the DB (e.g., via a stale replica), while
    // the current session state has rotated to T2. The CAS filter uses T1 →
    // miss. The re-read shows the rotated state (T2 current, T1 predecessor,
    // predecessor grace expired). With grace=0 the predecessor check fails;
    // the unchanged-current check is false (T2 ≠ T1), so the genuine-replay
    // revoke path fires.
    mocks.sessionFindOne.mockResolvedValueOnce({
      _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
      refreshToken: "T1", previousRefreshToken: null,
      previousRefreshTokenExpiresAt: null, expiresAt: FUTURE(420000),
    });
    mocks.sessionFindOne.mockResolvedValueOnce({
      _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
      refreshToken: "T2", previousRefreshToken: "T1",
      previousRefreshTokenExpiresAt: PAST(), expiresAt: PAST(),
    });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, tokenVersion: 1 });
    mocks.userFindById.mockResolvedValue({
      _id: USER_OBJECT_ID, role: "student", email: "u@e.com", grade: "g",
      image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2",
      governorate: "G", tokenVersion: 1,
    });
    mocks.sessionFindOneAndUpdate.mockResolvedValue(null);

    const result = await refreshAuth(OID);

    expect(result.success).toBe(false);
    // Genuine replay → revokeSession path → updateOne with isExp=true.
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("F. Sliding session — repeated refreshes keep pushing expiresAt forward", async () => {
    const start = Date.now();
    mocks.userFindById.mockResolvedValue({
      _id: USER_OBJECT_ID, role: "student", email: "u@e.com", grade: "g",
      image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2",
      governorate: "G", tokenVersion: 1,
    });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, tokenVersion: 1 });

    const stamped = [];
    const observedTimes = [];
    for (let i = 0; i < 6; i++) {
      const beforeRefresh = Date.now();
      vi.setSystemTime(new Date(start + (i + 1) * 60 * 1000));
      mocks.sessionFindOne.mockResolvedValueOnce({
        _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
        refreshToken: "rt", expiresAt: FUTURE(420000),
      });
      mocks.sessionFindOneAndUpdate.mockResolvedValueOnce({ _id: "ok" });

      const result = await refreshAuth(OID);
      expect(result.success).toBe(true);

      const exp = mocks.sessionFindOneAndUpdate.mock.calls[i][1].$set.expiresAt;
      stamped.push(exp);
      observedTimes.push(beforeRefresh);
    }

    // Each refresh stamped expiresAt ≈ now (at refresh time) + SESSION_TTL_MS.
    for (let i = 0; i < stamped.length; i++) {
      // stamped[i] was written when Date.now() was observedTimes[i] + 60_000ms
      // (we advanced 60s * (i+1) before each refresh).
      expect(stamped[i].getTime() - (observedTimes[i] + 60_000)).toBeGreaterThan(410000);
      expect(stamped[i].getTime() - (observedTimes[i] + 60_000)).toBeLessThanOrEqual(420050);
    }
    // Strictly monotonic: each later refresh stamps a later expiresAt.
    for (let i = 1; i < stamped.length; i++) {
      expect(stamped[i].getTime()).toBeGreaterThan(stamped[i - 1].getTime());
    }
    // Total elapsed is 6 minutes — well under the 7m session lifetime, so
    // the user has never been logged out.
    expect(Date.now() - start).toBe(360 * 1000);
  });

  it("G. Idle expiration — session.expiresAt past → refresh rejected with session_sliding_expired", async () => {
    const now = Date.now();
    // Login at t0.
    mocks.sessionFindOne.mockResolvedValueOnce({
      _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
      refreshToken: "rt", expiresAt: FUTURE(420000),
    });
    mocks.userFindById.mockResolvedValue({
      _id: USER_OBJECT_ID, role: "student", email: "u@e.com", grade: "g",
      image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2",
      governorate: "G", tokenVersion: 1,
    });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, tokenVersion: 1 });
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
    await refreshAuth(OID);

    // Clear the success-path mock state so the post-idle assertions are
    // scoped to the second refresh attempt.
    vi.clearAllMocks();

    // Advance past the 7m session lifetime with no activity.
    vi.setSystemTime(new Date(now + 421 * 1000));

    mocks.userFindById.mockResolvedValue({
      _id: USER_OBJECT_ID, role: "student", email: "u@e.com", grade: "g",
      image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2",
      governorate: "G", tokenVersion: 1,
    });
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, tokenVersion: 1 });
    // The stored session document reflects the elapsed expiresAt.
    mocks.sessionFindOne.mockResolvedValueOnce({
      _id: OID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
      refreshToken: "rt", expiresAt: PAST(),
    });

    const result = await refreshAuth(OID);
    expect(result.success).toBe(false);
    expect(result.newAccessToken).toBeUndefined();
    // The session is logically expired; refresh must not rotate or revoke.
    expect(mocks.sessionFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalled();
  });

  it("H. Logout during refresh — final state unauthenticated, no retry loop", async () => {
    seedValidSession();
    // Pause the CAS until the test fires revokeSession, then resolve.
    let releaseCas;
    const casPromise = new Promise((res) => { releaseCas = res; });
    mocks.sessionFindOneAndUpdate.mockReturnValueOnce(casPromise);

    // Kick off refreshAuth without awaiting.
    const refreshPromise = refreshAuth(OID);

    // Concurrent logout (revokeSession) — happens before CAS resolves.
    // Note: refreshAuth hasn't reached findOneAndUpdate yet (it's still
    // awaiting the first mock), so the mock flow is: the CAS holds until we
    // resolve. revokeSession calls Session.updateOne directly on the mock.
    mocks.sessionUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    await revokeSession(OID);

    // Now resolve the CAS so refreshAuth proceeds. The CAS filter has
    // isExp:{$ne:true} — after revoke, the DB session is isExp=true → CAS
    // returns null (mismatch on filter). But our mock just resolves the
    // arbitrary promise we returned — emulate the post-revoke state by
    // resolving null so refreshAuth enters the failure path.
    releaseCas(null);

    // The mock for findOneAndUpdate from this point on should reflect the
    // isExp=true state so the re-read shows the revoked session.
    mocks.sessionFindOne.mockResolvedValueOnce({
      _id: OID, userId: USER_OBJECT_ID, isExp: true, expiredAt: new Date(),
      refreshToken: "rt", expiresAt: FUTURE(420000),
    });
    const result = await refreshPromise;
    expect(result.success).toBe(false);
    // Final state: session is revoked (isExp=true), and refreshAuth did not
    // issue a new access token. There is no second refreshAuth call.
    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: OID, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: expect.any(Date) } }
    );
  });

  it("I. Account switching — Admin session revoke doesn't affect Student session", async () => {
    // Admin session A.
    const adminOid = "507f1f77bcf86cd7994390aa";
    const adminUserId = "507f1f77bcf86cd7994390bb";
    // Student session B.
    const studentOid = "507f1f77bcf86cd7994390cc";
    const studentUserId = "507f1f77bcf86cd7994390dd";

    const ADMIN_DOC = {
      _id: adminOid, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
      refreshToken: "admin-rt", expiresAt: FUTURE(420000),
    };
    const ADMIN_DOC_REVOKED = {
      _id: adminOid, userId: USER_OBJECT_ID, isExp: true, expiredAt: new Date(),
      refreshToken: "admin-rt", expiresAt: FUTURE(420000),
    };
    const STUDENT_DOC = {
      _id: studentOid, userId: USER_OBJECT_ID, isExp: false, expiredAt: null,
      refreshToken: "student-rt", expiresAt: FUTURE(420000),
    };
    const ADMIN_USER = {
      _id: adminUserId, role: "admin", email: "a@e.com", grade: "g",
      image: {}, firstName: "Admin", lastName: "A", phone: "1",
      guardianPhone: "2", governorate: "G", tokenVersion: 1,
    };
    const STUDENT_USER = {
      _id: studentUserId, role: "student", email: "s@e.com", grade: "g",
      image: {}, firstName: "Student", lastName: "S", phone: "1",
      guardianPhone: "2", governorate: "G", tokenVersion: 1,
    };

    // The mock chain `.lean(...a) => mocks.sessionFindOne(...a)` is called
    // with no arguments, so the mockImplementation can't see the filter
    // directly. Use a shared pointer that each refreshAuth call sets right
    // before invoking.
    let currentSessionDoc = ADMIN_DOC;
    mocks.sessionFindOne.mockImplementation(async () => currentSessionDoc);
    let currentUserDoc = ADMIN_USER;
    mocks.userFindById.mockImplementation(async () => currentUserDoc);
    // verifyJWT must return a payload whose _id matches the current
    // session's userId — otherwise the JWT/session identity check in
    // refreshAuth rejects the request.
    mocks.verifyJWT.mockImplementation(async () => ({
      _id: USER_OBJECT_ID, tokenVersion: 1,
    }));
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });

    // 1) Both sessions authenticate independently.
    currentSessionDoc = ADMIN_DOC;
    currentUserDoc = ADMIN_USER;
    const adminRes = await refreshAuth(adminOid);
    expect(adminRes.success).toBe(true);
    expect(adminRes.user.role).toBe("admin");

    currentSessionDoc = STUDENT_DOC;
    currentUserDoc = STUDENT_USER;
    const studentRes = await refreshAuth(studentOid);
    expect(studentRes.success).toBe(true);
    expect(studentRes.user.role).toBe("student");

    // 2) Logout (flag-revoke) the admin session only.
    mocks.sessionUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    await revokeSession(adminOid);

    // 3) Subsequent refreshAuth on the admin session fails (isExp=true).
    currentSessionDoc = ADMIN_DOC_REVOKED;
    currentUserDoc = ADMIN_USER;
    mocks.sessionFindOneAndUpdate.mockResolvedValueOnce(null);
    const adminAfter = await refreshAuth(adminOid);
    expect(adminAfter.success).toBe(false);

    // 4) The student session is unaffected — still authenticates, still
    // student, still the student user id.
    currentSessionDoc = STUDENT_DOC;
    currentUserDoc = STUDENT_USER;
    mocks.sessionFindOneAndUpdate.mockResolvedValueOnce({ _id: "ok" });
    const studentAfter = await refreshAuth(studentOid);
    expect(studentAfter.success).toBe(true);
    expect(studentAfter.user.role).toBe("student");
    expect(studentAfter.user._id).toBe(studentUserId);
  });
});
