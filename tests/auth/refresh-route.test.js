import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieHeaders = [];
let jsonData = null;
let jsonStatus = 200;

const NextResponse = {
  json: (data, init = {}) => {
    jsonData = data;
    jsonStatus = init.status || 200;
    return {
      headers: {
        set(name, value) { cookieHeaders.push({ op: "set", name, value }); },
        append(name, value) { cookieHeaders.push({ op: "append", name, value }); },
      },
    };
  },
};

vi.mock("next/server", () => ({ NextResponse }));

vi.mock("cookie", () => ({
  serialize: (name, value, opts) =>
    `${name}=${String(value).slice(0, 10)}; MaxAge=${opts.maxAge ?? "unset"}; Expires=${opts.expires ? opts.expires.toUTCString() : "none"}`,
}));

const mocks = vi.hoisted(() => ({
  refreshAuth: vi.fn(),
  rateLimited: vi.fn().mockResolvedValue(false),
  logSecurityEvent: vi.fn(),
}));

vi.mock("../../lib/refreshAuth", () => ({ refreshAuth: (...a) => mocks.refreshAuth(...a) }));
vi.mock("../../lib/routeRateLimit", () => ({ checkRouteRateLimit: (...a) => mocks.rateLimited(...a) }));
vi.mock("../../lib/securityLogger", () => ({ logSecurityEvent: (...a) => mocks.logSecurityEvent(...a) }));
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

const { GET: refreshRoute } = await import("../../src/app/api/auth/refresh/route");

const OID = "507f1f77bcf86cd799439011";

function makeReq({ sessionId = OID, accessToken = "old.access" } = {}) {
  return {
    cookies: {
      get: (name) => {
        if (name === "s-i" && sessionId) return { value: sessionId };
        if (name === "access_token" && accessToken) return { value: accessToken };
        return undefined;
      },
    },
  };
}

describe("GET /api/auth/refresh — baseline behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshAuth.mockReset();
    cookieHeaders.length = 0;
    jsonData = null;
    jsonStatus = 200;
    mocks.rateLimited.mockResolvedValue(false);
  });

  it("RE1: success — sets access_token (MaxAge=1800) AND slides s-i (MaxAge=604800)", async () => {
    mocks.refreshAuth.mockResolvedValue({
      success: true,
      user: { _id: "u1", role: "student" },
      newAccessToken: "fresh.access.token",
    });

    await refreshRoute(makeReq());

    expect(jsonStatus).toBe(200);
    expect(jsonData.newAccessToken).toBe("fresh.access.token");

    // Phase 4: both cookies are now re-issued so the session slides.
    expect(cookieHeaders).toHaveLength(2);

    const access = cookieHeaders.find((c) => c.value.startsWith("access_token="));
    const si = cookieHeaders.find((c) => c.value.startsWith("s-i="));
    expect(access).toBeDefined();
    expect(access.value).toContain("MaxAge=1800");
    expect(si).toBeDefined();
    expect(si.value).toContain("MaxAge=604800");
  });

  it("RE2: refresh failure — 401, no cookies written", async () => {
    mocks.refreshAuth.mockResolvedValue({ success: false, message: "User not authenticated" });

    await refreshRoute(makeReq());

    expect(jsonStatus).toBe(401);
    expect(cookieHeaders).toHaveLength(0);
  });

  it("RE3: rate limited — 429, refreshAuth never called", async () => {
    mocks.rateLimited.mockResolvedValue(true);

    await refreshRoute(makeReq());

    expect(jsonStatus).toBe(429);
    expect(mocks.refreshAuth).not.toHaveBeenCalled();
  });

  it("RE4: missing s-i cookie — refreshAuth called with undefined, fails as 401", async () => {
    mocks.refreshAuth.mockResolvedValue({ success: false, message: "User not authenticated" });

    await refreshRoute(makeReq({ sessionId: null }));

    expect(mocks.refreshAuth).toHaveBeenCalledWith(undefined);
    expect(jsonStatus).toBe(401);
  });
});
