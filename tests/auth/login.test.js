import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieHeaders = [];
let jsonData = null;
let jsonStatus = 200;
let responseObj = null;

const NextResponse = {
  json: (data, init = {}) => {
    jsonData = data;
    jsonStatus = init.status || 200;
    responseObj = {
      headers: {
        set(name, value) { cookieHeaders.push({ op: "set", name, value }); },
        append(name, value) { cookieHeaders.push({ op: "append", name, value }); },
      },
    };
    return responseObj;
  },
};

vi.mock("next/server", () => ({ NextResponse }));

vi.mock("cookie", () => ({
  serialize: (name, value, opts) =>
    `${name}=${String(value).slice(0, 10)}; MaxAge=${opts.maxAge ?? "unset"}; Expires=${opts.expires ? opts.expires.toUTCString() : "none"}`,
}));

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  sessionFind: vi.fn().mockResolvedValue([]),
  sessionUpdateMany: vi.fn(),
  sessionCreate: vi.fn().mockResolvedValue({ _id: "507f1f77bcf86cd7994390aa" }),
  bcryptCompare: vi.fn().mockResolvedValue(true),
  signJWT: vi.fn(async (payload, exp) => `token.${exp}`),
  connectToDb: vi.fn().mockResolvedValue(true),
  rateLimited: vi.fn().mockResolvedValue(false),
  validateOrigin: vi.fn().mockReturnValue(null),
  logSecurityEvent: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: (...a) => mocks.bcryptCompare(...a) },
  compare: (...a) => mocks.bcryptCompare(...a),
}));
vi.mock("../../lib/jwt", () => ({ signJWT: (...a) => mocks.signJWT(...a) }));
vi.mock("../../lib/connectToDb", () => ({ default: (...a) => mocks.connectToDb(...a) }));
vi.mock("../../lib/routeRateLimit", () => ({ checkRouteRateLimit: (...a) => mocks.rateLimited(...a) }));
vi.mock("../../lib/securityLogger", () => ({ logSecurityEvent: (...a) => mocks.logSecurityEvent(...a) }));
vi.mock("../../lib/validateOrigin", () => ({ validateOrigin: (...a) => mocks.validateOrigin(...a) }));
vi.mock("../../lib/trace/index.js", () => ({
  withCaller: (_n, fn) => fn(),
  withTracePhase: (_n, fn) => fn(),
  withHttpTrace: (_req, _n, fn) => fn(),
  setContextFields: () => {},
  emit: () => {},
  emitHttp: () => {},
  emitCookie: () => {},
  hashToken: (t) => String(t).slice(0, 10),
  nowIso: () => "",
  tsHr: () => "",
}));
vi.mock("../../models/User", () => ({
  default: { findOne: () => ({ lean: (...a) => mocks.userFindOne(...a) }) },
}));
vi.mock("../../models/Session", () => ({
  default: {
    find: (...a) => mocks.sessionFind(...a),
    updateMany: (...a) => mocks.sessionUpdateMany(...a),
    create: (...a) => mocks.sessionCreate(...a),
  },
}));

const { POST: login } = await import("../../src/app/api/auth/login/route");
import { SESSION_TTL_MS } from "../../lib/auth/config";

const USER_DOC = {
  _id: "u1",
  role: "student",
  email: "u@example.com",
  phone: "010",
  grade: "g1",
  image: { url: "", cloudId: "" },
  firstName: "First",
  lastName: "Last",
  guardianPhone: "011",
  governorate: "Cairo",
  password: "hashed.pw",
  tokenVersion: 1,
};

function makeReq(body) {
  return {
    headers: { get: () => null },
    json: async () => body,
  };
}

describe("POST /api/auth/login — baseline behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieHeaders.length = 0;
    jsonData = null;
    jsonStatus = 200;
    responseObj = null;
    mocks.userFindOne.mockResolvedValue({ ...USER_DOC });
    mocks.sessionFind.mockResolvedValue([]);
    mocks.sessionCreate.mockResolvedValue({ _id: "507f1f77bcf86cd7994390aa" });
    mocks.bcryptCompare.mockResolvedValue(true);
    mocks.signJWT.mockImplementation(async (_payload, exp) => `token.${exp}`);
    mocks.rateLimited.mockResolvedValue(false);
    mocks.validateOrigin.mockReturnValue(null);
  });

  it("LI1: successful login — 30m/7d JWTs, access_token MaxAge=1800, s-i MaxAge=604800, session created", async () => {
    await login(makeReq({ emailOrPhone: "u@example.com", password: "pw", fingerprint: "fp1" }));

    expect(jsonStatus).toBe(200);
    expect(jsonData.role).toBe("student");
    expect(jsonData.user._id).toBe("u1");

    const exps = mocks.signJWT.mock.calls.map((c) => c[1]);
    expect(exps).toContain("30m");
    expect(exps).toContain("7d");

    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        refreshToken: "token.7d",
        fingerprint: "fp1",
        expiresAt: expect.any(Date),
      })
    );

    // Phase 4: expiresAt must be ~now + SESSION_TTL_MS at session creation.
    const createdAtMs = Date.now();
    const stampedExpiresAt = mocks.sessionCreate.mock.calls[0][0].expiresAt.getTime();
    expect(stampedExpiresAt).toBeGreaterThan(createdAtMs + SESSION_TTL_MS - 50);
    expect(stampedExpiresAt).toBeLessThan(createdAtMs + SESSION_TTL_MS + 50);

    expect(cookieHeaders).toHaveLength(2);
    const access = cookieHeaders.find((c) => c.value.startsWith("access_token="));
    const si = cookieHeaders.find((c) => c.value.startsWith("s-i="));
    expect(access).toBeDefined();
    expect(access.value).toContain("MaxAge=1800");
    expect(si).toBeDefined();
    expect(si.value).toContain("MaxAge=604800");
  });

  it("LI2: existing sessions with a DIFFERENT fingerprint are expired on login", async () => {
    mocks.sessionFind.mockResolvedValue([
      { _id: "s1", fingerprint: "other" },
      { _id: "s2", fingerprint: "fp1" },
    ]);

    await login(makeReq({ emailOrPhone: "u@example.com", password: "pw", fingerprint: "fp1" }));

    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $in: ["s1"] } }),
      expect.objectContaining({ $set: expect.objectContaining({ isExp: true }) })
    );
  });

  it("LI3: existing sessions with the SAME fingerprint are left untouched", async () => {
    mocks.sessionFind.mockResolvedValue([{ _id: "s1", fingerprint: "fp1" }]);

    await login(makeReq({ emailOrPhone: "u@example.com", password: "pw", fingerprint: "fp1" }));

    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("LI4: wrong password — 401, no session, no cookies", async () => {
    mocks.bcryptCompare.mockResolvedValue(false);

    await login(makeReq({ emailOrPhone: "u@example.com", password: "bad", fingerprint: "fp1" }));

    expect(jsonStatus).toBe(401);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(cookieHeaders).toHaveLength(0);
  });

  it("LI5: unknown user — 401", async () => {
    mocks.userFindOne.mockResolvedValue(null);

    await login(makeReq({ emailOrPhone: "nobody@example.com", password: "pw", fingerprint: "fp1" }));

    expect(jsonStatus).toBe(401);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("LI6: rate limited — 429 before any DB work", async () => {
    mocks.rateLimited.mockResolvedValue(true);

    await login(makeReq({ emailOrPhone: "u@example.com", password: "pw", fingerprint: "fp1" }));

    expect(jsonStatus).toBe(429);
    expect(mocks.connectToDb).not.toHaveBeenCalled();
    expect(mocks.userFindOne).not.toHaveBeenCalled();
  });

  it("LI7: origin mismatch — validation response returned directly", async () => {
    const forbidden = { status: 403, body: "forbidden" };
    mocks.validateOrigin.mockReturnValue(forbidden);

    const res = await login(makeReq({ emailOrPhone: "u@example.com", password: "pw" }));

    expect(res).toBe(forbidden);
    expect(mocks.connectToDb).not.toHaveBeenCalled();
  });
});
