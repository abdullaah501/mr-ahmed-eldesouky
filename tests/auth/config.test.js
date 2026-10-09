import { describe, it, expect } from "vitest";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  ACCESS_TOKEN_COOKIE_MAX_AGE,
  SESSION_COOKIE_MAX_AGE,
  AUTH_COOKIES,
  authCookieOpts,
  accessCookieOpts,
  sessionCookieOpts,
  serializeAccessCookie,
  serializeSessionCookie,
  serializeClearedAccessCookie,
  serializeClearedSessionCookie,
} from "../../lib/auth/config";

describe("lib/auth/config — centralized auth constants (Phase 1)", () => {
  it("CFG1: TTL constants match the pre-refactor production values", () => {
    expect(ACCESS_TOKEN_TTL).toBe("30m");
    expect(REFRESH_TOKEN_TTL).toBe("7d");
    expect(ACCESS_TOKEN_COOKIE_MAX_AGE).toBe(1800);
    expect(SESSION_COOKIE_MAX_AGE).toBe(604800);
  });

  it("CFG2: cookie names unchanged", () => {
    expect(AUTH_COOKIES.access).toBe("access_token");
    expect(AUTH_COOKIES.session).toBe("s-i");
  });

  it("CFG3: base cookie options preserve the previous security policy", () => {
    expect(authCookieOpts()).toEqual({
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  });

  it("CFG4: access/session cookie options carry the TTL-derived maxAge", () => {
    expect(accessCookieOpts()).toEqual({ ...authCookieOpts(), maxAge: 1800 });
    expect(sessionCookieOpts()).toEqual({ ...authCookieOpts(), maxAge: 604800 });
  });

  it("CFG5: serialized cookies match the previous Set-Cookie shape", () => {
    expect(serializeAccessCookie("tok")).toBe(
      "access_token=tok; Max-Age=1800; Path=/; HttpOnly; SameSite=Lax"
    );
    expect(serializeSessionCookie("sess")).toBe(
      "s-i=sess; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax"
    );
  });

  it("CFG6: cleared cookies expire at the epoch (logout semantics preserved)", () => {
    expect(serializeClearedAccessCookie()).toBe(
      "access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
    );
    expect(serializeClearedSessionCookie()).toBe(
      "s-i=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
    );
  });
});
