import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  gradeFindById: vi.fn(),
  userFindOne: vi.fn(),
}));

vi.mock("../../models/User", async (importOriginal) => {
  const real = await importOriginal();
  return {
    default: {
      ...real.default,
      findOne: (...a) => mocks.userFindOne(...a),
      create: (...a) => mocks.create(...a),
    },
  };
});

vi.mock("../../models/Grade", () => ({
  default: { findById: (...a) => mocks.gradeFindById(...a) },
}));

vi.mock("../../models/Session", () => ({
  default: { create: vi.fn().mockResolvedValue({ _id: "sess1" }) },
}));

vi.mock("../../lib/connectToDb", () => ({ default: vi.fn() }));

vi.mock("../../lib/jwt", () => ({
  signJWT: vi.fn().mockResolvedValue("token"),
}));

vi.mock("../../lib/auth/config", () => ({
  ACCESS_TOKEN_TTL: "30m",
  REFRESH_TOKEN_TTL: "7d",
  ACCESS_TOKEN_COOKIE_MAX_AGE: 1800,
  SESSION_COOKIE_MAX_AGE: 604800,
  SESSION_TTL_MS: 604800000,
  serializeAccessCookie: vi.fn().mockReturnValue("a"),
  serializeSessionCookie: vi.fn().mockReturnValue("s"),
}));

vi.mock("../../lib/securityLogger", () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock("../../lib/validateOrigin", () => ({
  validateOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock("../../lib/routeRateLimit", () => ({
  checkRouteRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../lib/trace/index.js", () => ({
  withCaller: (_n, fn) => fn(),
  withHttpTrace: (_req, _n, fn) => fn(),
  withTracePhase: (_p, fn) => fn(),
  setContextFields: vi.fn(),
  emit: vi.fn(),
  emitHttp: vi.fn(),
  emitCookie: vi.fn(),
  hashToken: vi.fn().mockReturnValue("h"),
  nowIso: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
}));

vi.mock("next/server", () => {
  const makeJson = (data, init = {}) => ({
    _data: data,
    status: init.status || 200,
    headers: {
      set: vi.fn(),
      append: vi.fn(),
    },
  });
  return {
    NextResponse: { json: makeJson },
  };
});

import { POST as register } from "../../src/app/api/auth/register/route.js";

const GID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const payload = {
  firstName: "Test",
  lastName: "Student",
  gradeId: GID,
  phone: "01000000000",
  guardianPhone: "01100000000",
  governorate: "القاهرة",
  email: "t@e.com",
  password: "secret123",
  role: "student",
  fingerprint: "fp",
};

function makeReq(
  body,
  url = "http://localhost:3000/api/auth/register"
) {
  return { json: async () => body, url, headers: { get: () => null } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindOne.mockImplementation(() => ({ lean: async () => null }));
  mocks.create.mockImplementation(async (data) => ({
    _id: "u1",
    ...data,
    tokenVersion: 1,
    image: { url: "", cloudId: "" },
  }));
});

describe("POST /api/auth/register — User.gradeId storage", () => {
  it("rejects an invalid grade id (400) without creating a user", async () => {
    const res = await register(makeReq({ ...payload, gradeId: "not-an-id" }));
    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a missing grade id (400)", async () => {
    const { gradeId, ...body } = payload;
    const res = await register(makeReq(body));
    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent grade (400)", async () => {
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    const res = await register(makeReq(payload));
    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive grade (400)", async () => {
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: GID, name: "Grade A", active: false }),
    });
    const res = await register(makeReq(payload));
    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("stores the validated gradeId and synchronizes the display grade string", async () => {
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: GID, name: "الصف الأول الثانوي", active: true }),
    });
    const res = await register(makeReq(payload));
    expect(res.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gradeId: GID,
        grade: "الصف الأول الثانوي",
      })
    );
  });

  it("does not trust a client grade string — only the resolved Grade document", async () => {
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: GID, name: "الصف الأول الثانوي", active: true }),
    });
    await register(makeReq({ ...payload, grade: "Hacked Grade" }));
    const created = mocks.create.mock.calls[0][0];
    expect(created.grade).toBe("الصف الأول الثانوي");
    expect(created.gradeId).toBe(GID);
  });
});

describe("User schema — gradeId/grade optionality", () => {
  it("gradeId and grade are optional at schema level (grade-less users allowed)", async () => {
    const User = (await import("../../models/User")).default;
    expect(User.schema.path("gradeId")).toBeDefined();
    expect(User.schema.path("gradeId").isRequired).toBeFalsy();
    // grade became nullable to support grade-less registrations (?mode=admin)
    expect(User.schema.path("grade").isRequired).toBeFalsy();
  });
});

describe("POST /api/auth/register — ?mode=admin (grade-optional, NOT admin role)", () => {
  const ADMIN_URL = "http://localhost:3000/api/auth/register?mode=admin";

  it("creates a grade-less user when no gradeId is supplied", async () => {
    const { gradeId, ...body } = payload;
    const res = await register(makeReq(body, ADMIN_URL));
    expect(res.status).toBe(200);
    expect(mocks.gradeFindById).not.toHaveBeenCalled();
    const created = mocks.create.mock.calls[0][0];
    expect(created.gradeId).toBeUndefined();
    expect(created.grade).toBeUndefined();
  });

  it("emits a token with null gradeId/grade for the grade-less user", async () => {
    const { signJWT } = await import("../../lib/jwt");
    const { gradeId, ...body } = payload;
    const res = await register(makeReq(body, ADMIN_URL));
    expect(res.status).toBe(200);
    expect(signJWT).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: null, grade: null }),
      expect.anything()
    );
  });

  it("never assigns a role from mode=admin or a forged body role", async () => {
    const { gradeId, ...body } = payload;
    const res = await register(makeReq({ ...body, role: "admin" }, ADMIN_URL));
    expect(res.status).toBe(200);
    const created = mocks.create.mock.calls[0][0];
    // Role is never passed to create — the schema default ("student") applies.
    expect(created.role).toBeUndefined();
  });

  it("still validates and stores a supplied gradeId in admin mode", async () => {
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: GID, name: "الصف الأول الثانوي", active: true }),
    });
    const res = await register(makeReq(payload, ADMIN_URL));
    expect(res.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: GID, grade: "الصف الأول الثانوي" })
    );
  });

  it("rejects an inactive grade supplied in admin mode (400)", async () => {
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: GID, name: "Grade A", active: false }),
    });
    const res = await register(makeReq(payload, ADMIN_URL));
    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("treats any other mode value as normal registration (grade required)", async () => {
    const { gradeId, ...body } = payload;
    for (const url of [
      "http://localhost:3000/api/auth/register?mode=foo",
      "http://localhost:3000/api/auth/register?mode=true",
      "http://localhost:3000/api/auth/register?mode=administrator",
      "http://localhost:3000/api/auth/register",
    ]) {
      const res = await register(makeReq(body, url));
      expect(res.status).toBe(400);
      expect(mocks.create).not.toHaveBeenCalled();
    }
    expect(mocks.gradeFindById).not.toHaveBeenCalled();
  });
});
