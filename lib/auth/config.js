import { serialize } from "cookie";

// Test/stress override: set AUTH_ACCESS_TOKEN_TTL / AUTH_REFRESH_TOKEN_TTL
// (e.g. "3m" / "7m") before importing the auth modules to run Phase 9
// stress scenarios. Production defaults are unchanged when the env vars are
// not set.
export const ACCESS_TOKEN_TTL = process.env.AUTH_ACCESS_TOKEN_TTL ?? "30m";
export const REFRESH_TOKEN_TTL = process.env.AUTH_REFRESH_TOKEN_TTL ?? "7d";

// Refresh-rotation grace window: how long a predecessor refresh token remains
// accepted as a legitimate concurrent-refresh loser (vs. a replay).
// Set AUTH_GRACE_WINDOW_MS=0 to disable the grace path entirely (rollback flag:
// restores the pre-Phase-2 "any CAS failure revokes the session" behavior).
export const REFRESH_GRACE_WINDOW_MS = Number(
  process.env.AUTH_GRACE_WINDOW_MS ?? 30000
);

function ttlToSeconds(ttl) {
  if (typeof ttl === "number") return ttl;
  const match = /^(\d+)\s*([smhd]?)$/.exec(String(ttl).trim());
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(match[1], 10) * multipliers[match[2] || "s"];
}

export const ACCESS_TOKEN_COOKIE_MAX_AGE = ttlToSeconds(ACCESS_TOKEN_TTL);
export const SESSION_COOKIE_MAX_AGE = ttlToSeconds(REFRESH_TOKEN_TTL);
export const SESSION_TTL_MS = SESSION_COOKIE_MAX_AGE * 1000;

export const AUTH_COOKIES = { access: "access_token", session: "s-i" };

export function authCookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function accessCookieOpts() {
  return { ...authCookieOpts(), maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE };
}

export function sessionCookieOpts() {
  return { ...authCookieOpts(), maxAge: SESSION_COOKIE_MAX_AGE };
}

export function clearedCookieOpts() {
  return { ...authCookieOpts(), expires: new Date(0) };
}

export function serializeAccessCookie(token) {
  return serialize(AUTH_COOKIES.access, token, accessCookieOpts());
}

export function serializeSessionCookie(sessionId) {
  return serialize(AUTH_COOKIES.session, sessionId, sessionCookieOpts());
}

export function serializeClearedAccessCookie() {
  return serialize(AUTH_COOKIES.access, "", clearedCookieOpts());
}

export function serializeClearedSessionCookie() {
  return serialize(AUTH_COOKIES.session, "", clearedCookieOpts());
}
