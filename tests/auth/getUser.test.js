import { describe, it, expect, vi, beforeEach } from "vitest";

let jsonData = null;
let jsonStatus = 200;

const NextResponse = {
  json: (data, init = {}) => {
    jsonData = data;
    jsonStatus = init.status || 200;
    return { headers: { set() {}, append() {} } };
  },
};

vi.mock("next/server", () => ({ NextResponse }));

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  userFindByIdSelect: vi.fn(),
  connectToDb: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../lib/jwt", () => ({ verifyJWT: (...a) => mocks.verifyJWT(...a) }));
vi.mock("../../lib/connectToDb", () => ({ default: (...a) => mocks.connectToDb(...a) }));
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
  default: { findById: (id) => ({ select: (fields) => mocks.userFindByIdSelect(id, fields) }) },
}));

const { GET: getUser } = await import("../../src/app/api/auth/getUser/route");

const USER_DOC = { _id: "u1", role: "student", email: "u@example.com", firstName: "First" };

function makeReq({ accessToken = "valid.jwt" } = {}) {
  return {
    cookies: {
      get: (name) => (name === "access_token" && accessToken ? { value: accessToken } : undefined),
    },
  };
}

describe("GET /api/auth/getUser — baseline behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyJWT.mockReset();
    mocks.userFindByIdSelect.mockReset();
    jsonData = null;
    jsonStatus = 200;
  });

  it("GU1: valid access token — returns DB user, no refresh attempted", async () => {
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", role: "student" });
    mocks.userFindByIdSelect.mockResolvedValue(USER_DOC);

    await getUser(makeReq());

    expect(jsonStatus).toBe(200);
    expect(jsonData).toEqual(USER_DOC);
    expect(mocks.verifyJWT).toHaveBeenCalledWith("valid.jwt");
    expect(mocks.userFindByIdSelect).toHaveBeenCalledWith("u1", "-password");
  });

  it("GU2: no access_token cookie — 401 before any DB or JWT work", async () => {
    await getUser(makeReq({ accessToken: null }));

    expect(jsonStatus).toBe(401);
    expect(mocks.verifyJWT).not.toHaveBeenCalled();
    expect(mocks.userFindByIdSelect).not.toHaveBeenCalled();
  });

  it("GU3: invalid/expired access token — 401 (this is what triggers the axios interceptor)", async () => {
    mocks.verifyJWT.mockRejectedValue(new Error("expired"));

    await getUser(makeReq());

    expect(jsonStatus).toBe(401);
    expect(mocks.userFindByIdSelect).not.toHaveBeenCalled();
  });

  it("GU4: token valid but user deleted — 404", async () => {
    mocks.verifyJWT.mockResolvedValue({ _id: "gone" });
    mocks.userFindByIdSelect.mockResolvedValue(null);

    await getUser(makeReq());

    expect(jsonStatus).toBe(404);
  });
});
