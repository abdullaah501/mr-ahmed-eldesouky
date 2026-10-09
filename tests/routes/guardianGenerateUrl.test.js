import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  userUpdateOne: vi.fn(),
}));

vi.mock("../../models/User", () => ({
  default: {
    findOne: (...a) => mocks.userFindOne(...a),
    updateOne: (...a) => mocks.userUpdateOne(...a),
  },
}));

vi.mock("../../lib/checkUser", () => ({
  default: vi.fn().mockResolvedValue({
    success: true,
    user: { _id: "s1", role: "student" },
  }),
}));

vi.mock("../../lib/connectToDb", () => ({ default: vi.fn() }));

vi.mock("../../lib/validateOrigin", () => ({
  validateOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock("../../lib/routeRateLimit", () => ({
  checkRouteRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../lib/securityLogger", () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock("../../lib/trace/index.js", () => ({
  withCaller: (_n, fn) => fn(),
  withHttpTrace: (_req, _n, fn) => fn(),
  withTracePhase: (_p, fn) => fn(),
  hashToken: vi.fn().mockReturnValue("h"),
}));

vi.mock("next/server", () => {
  const makeJson = (data, init = {}) => ({
    _data: data,
    status: init.status || 200,
  });
  return {
    NextResponse: { json: makeJson },
  };
});

import { POST as generate } from "../../src/app/api/guardian/generate/route.js";

// Simulates a behind-a-reverse-proxy request: the internal req.url is
// localhost even though the public site is the real domain.
function makeReq(
  url = "http://localhost:3000/api/guardian/generate"
) {
  return { json: async () => ({}), url, headers: { get: () => null } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindOne.mockImplementation(() => ({
    select: vi.fn().mockResolvedValue({ _id: "s1" }),
  }));
  mocks.userUpdateOne.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/guardian/generate — guardian link base URL", () => {
  it("builds the portal link from the configured public base URL (production)", async () => {
    vi.stubEnv("NEXT_PUBLIC_URL", "https://faydel3arabia.com");
    const res = await generate(makeReq());
    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(res._data.url).toBe(
      `https://faydel3arabia.com/p/${res._data.token}`
    );
    expect(res._data.url).not.toContain("localhost");
    expect(res._data.url).not.toContain("127.0.0.1");
  });

  it("normalizes a base URL with a trailing slash (no // in the path)", async () => {
    vi.stubEnv("NEXT_PUBLIC_URL", "https://faydel3arabia.com/");
    const res = await generate(makeReq());
    expect(res._data.url).toBe(
      `https://faydel3arabia.com/p/${res._data.token}`
    );
  });

  it("uses only the origin of the configured base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_URL", "https://faydel3arabia.com/subpath/");
    const res = await generate(makeReq());
    expect(res._data.url).toBe(
      `https://faydel3arabia.com/p/${res._data.token}`
    );
  });

  it("falls back to the request origin when NEXT_PUBLIC_URL is unset (dev)", async () => {
    vi.stubEnv("NEXT_PUBLIC_URL", undefined);
    const res = await generate(makeReq());
    expect(res._data.url).toBe(
      `http://localhost:3000/p/${res._data.token}`
    );
  });

  it("falls back to the request origin when NEXT_PUBLIC_URL is malformed", async () => {
    vi.stubEnv("NEXT_PUBLIC_URL", "not-a-url");
    const res = await generate(makeReq());
    expect(res._data.url).toBe(
      `http://localhost:3000/p/${res._data.token}`
    );
  });
});
