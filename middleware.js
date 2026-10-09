// middleware.js - في root directory
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { AUTH_COOKIES, accessCookieOpts, sessionCookieOpts } from './lib/auth/config';

// JWT secret — jose's jwtVerify is Edge-safe (no Node.js APIs).
// Initialised once per middleware module load, not per request.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Protected page route prefixes that benefit from middleware-level token refresh.
// API routes under these prefixes are NOT matched here (see matcher config).
const PROTECTED_PREFIXES = ['/dashboard', '/userDashboard', '/grades'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Auth token pre-refresh for protected page navigations ────────────────────
  //
  // Why Sec-Fetch-Mode: navigate?
  //   A full page load (hard nav, new tab, reopened site) sends exactly ONE
  //   request with Sec-Fetch-Mode: navigate. Parallel XHR/RSC/prefetch requests
  //   use cors/no-cors/etc. — they bypass this branch entirely. This structurally
  //   prevents concurrent calls to /api/auth/refresh, which would cause CAS
  //   collisions (REFRESH_REPLAY_DETECTED) and kill the session.
  //
  // What this does:
  //   1. Verifies access_token with jose (Edge-safe, no Node.js APIs).
  //   2. If expired/missing AND s-i session cookie exists, calls /api/auth/refresh
  //      with the user's real IP forwarded so rate-limiting stays per-user.
  //   3. On success: mutates the request cookie so checkUser() in the layout
  //      sees the fresh access_token (preventing a second refreshAuth() call),
  //      and sets the same cookie on the response so the browser stores it.
  //   4. On failure (401/429/network): passes through — the layout's checkUser()
  //      will return { success: false } and redirect to "/" as normal.
  //
  const isProtectedRoute = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  const isNavigationRequest = request.headers.get('sec-fetch-mode') === 'navigate';

  if (isProtectedRoute && isNavigationRequest) {
    const accessToken = request.cookies.get(AUTH_COOKIES.access)?.value;
    const sessionId = request.cookies.get(AUTH_COOKIES.session)?.value;

    // Fast path: valid access token → pass through with no extra work
    let accessTokenValid = false;
    if (accessToken) {
      try {
        await jwtVerify(accessToken, JWT_SECRET);
        accessTokenValid = true;
      } catch {
        // expired or invalid — fall through to refresh attempt
      }
    }

    // Slow path: token expired/missing but session cookie present → try refresh
    if (!accessTokenValid && sessionId) {
      try {
        const refreshUrl = new URL('/api/auth/refresh', request.nextUrl.origin);

        // Forward the real client IP so /api/auth/refresh rate-limits per user,
        // not per server IP.
        const clientIp =
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          request.headers.get('x-real-ip') ||
          '';

        const res = await fetch(refreshUrl.toString(), {
          headers: {
            cookie: `${AUTH_COOKIES.session}=${sessionId}`,
            ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
          },
          // Prevent any fetch-level or Edge-runtime HTTP cache from reusing a
          // stale refresh result across requests.
          cache: 'no-store',
        });

        if (res.ok) {
          const body = await res.json();
          const newAccessToken = body?.newAccessToken;

          if (newAccessToken) {
            // Mutate the request's cookie store so the downstream Server Component
            // (layout's checkUser()) reads the fresh access_token from cookies()
            // and takes the fast JWT-verify path — no second refreshAuth() call.
            request.cookies.set(AUTH_COOKIES.access, newAccessToken);
            const response = NextResponse.next({ request });

            // Set both cookies on the outgoing response so the browser
            // persists them. The access_token is fresh (30m); the s-i cookie
            // slides forward to SESSION_COOKIE_MAX_AGE so an active
            // user is never logged out at the original login boundary.
            response.cookies.set(AUTH_COOKIES.access, newAccessToken, accessCookieOpts());
            if (sessionId) {
              response.cookies.set(AUTH_COOKIES.session, sessionId, sessionCookieOpts());
            }

            return response;
          }
        }
        // refresh failed (401 = bad/expired session, 429 = rate limited):
        // fall through to NextResponse.next() — layout handles redirect.
      } catch {
        // network error or JSON parse failure → fall through
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protected page routes (auth pre-refresh applies here)
    '/dashboard/:path*',
    '/userDashboard/:path*',
  ],
};
