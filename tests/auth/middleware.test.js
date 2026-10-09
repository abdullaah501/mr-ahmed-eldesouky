import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

const h = vi.hoisted(() => ({
  responseCookieSet: vi.fn(),
  nextMock: vi.fn((opts) => ({ cookies: { set: h.responseCookieSet }, __nextOpts: opts })),
}));

vi.mock("next/server", () => ({
  NextResponse: { next: (...a) => h.nextMock(...a) },
}));

const { middleware } = await import("../../middleware.js");

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function signToken(payload, expiresAtUnixSeconds) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAtUnixSeconds)
    .sign(secret);
}

function makeRequest(path, { secFetchMode = "navigate", accessToken, sessionId } = {}) {
  const cookieMap = new Map();
  if (accessToken !== undefined) cookieMap.set("access_token", accessToken);
  if (sessionId !== undefined) cookieMap.set("s-i", sessionId);

  const headerMap = new Map();
  if (secFetchMode !== undefined) headerMap.set("sec-fetch-mode", secFetchMode);

  return {
    nextUrl: { pathname: path, origin: "http://localhost:3000" },
    url: `http://localhost:3000${path}`,
    headers: { get: (name) => (headerMap.has(name) ? headerMap.get(name) : null) },
    cookies: {
      get: (name) => (cookieMap.has(name) ? { value: cookieMap.get(name) } : undefined),
      set: (name, value) => cookieMap.set(name, value),
    },
    __cookieMap: cookieMap,
  };
}

describe("middleware — protected-route refresh baseline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("MW1: valid access token on navigation — fast pass-through, no refresh fetch", async () => {
    const token = await signToken({ _id: "u1" }, Math.floor(Date.now() / 1000) + 1800);
    const req = makeRequest("/dashboard/overview", { accessToken: token, sessionId: "sess1" });

    await middleware(req);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(h.responseCookieSet).not.toHaveBeenCalled();
    expect(h.nextMock).toHaveBeenCalledTimes(1);
  });

  it("MW2: expired token + s-i on navigation — ONE refresh fetch, request cookie mutated, response cookies slide", async () => {
    const expired = await signToken({ _id: "u1" }, Math.floor(Date.now() / 1000) - 10);
    const req = makeRequest("/dashboard/overview", { accessToken: expired, sessionId: "sess123" });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ newAccessToken: "fresh.token" }),
    });

    await middleware(req);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(String(url)).toContain("/api/auth/refresh");
    expect(init.headers.cookie).toBe("s-i=sess123");
    expect(init.cache).toBe("no-store");

    // Downstream server components (checkUser) see the fresh token
    expect(req.__cookieMap.get("access_token")).toBe("fresh.token");

    // Phase 4: middleware now also slides the s-i cookie on hard navigations
    // so an active user is never logged out at the original login boundary.
    expect(h.responseCookieSet).toHaveBeenCalledWith(
      "access_token",
      "fresh.token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 1800 })
    );
    expect(h.responseCookieSet).toHaveBeenCalledWith(
      "s-i",
      "sess123",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 604800 })
    );
  });

  it("MW3: refresh fetch fails — clean pass-through, no cookie written", async () => {
    const expired = await signToken({ _id: "u1" }, Math.floor(Date.now() / 1000) - 10);
    const req = makeRequest("/userDashboard/overview", { accessToken: expired, sessionId: "sess1" });

    global.fetch.mockResolvedValue({ ok: false, status: 401 });

    await middleware(req);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(h.responseCookieSet).not.toHaveBeenCalled();
    expect(h.nextMock).toHaveBeenCalledTimes(1);
    expect(req.__cookieMap.get("access_token")).toBe(expired);
  });

  it("MW4: non-navigate request (SPA/RSC/xhr) — refresh NEVER runs even with expired token", async () => {
    const expired = await signToken({ _id: "u1" }, Math.floor(Date.now() / 1000) - 10);
    const req = makeRequest("/dashboard/overview", {
      secFetchMode: "cors",
      accessToken: expired,
      sessionId: "sess1",
    });

    await middleware(req);

    // Baseline limitation: SPA navigations rely on checkUser()'s in-render
    // refresh, which does not persist the cookie.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(h.responseCookieSet).not.toHaveBeenCalled();
  });

  it("MW5: unprotected path — no refresh logic at all", async () => {
    const expired = await signToken({ _id: "u1" }, Math.floor(Date.now() / 1000) - 10);
    const req = makeRequest("/", { accessToken: expired, sessionId: "sess1" });

    await middleware(req);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(h.nextMock).toHaveBeenCalledTimes(1);
  });
});
