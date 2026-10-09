import { cookies } from "next/headers";
import { AUTH_COOKIES, accessCookieOpts } from "./config";

// Phase 3 — centralized access-token persistence.
//
// Best-effort by design: Next.js only permits cookie mutation inside Route
// Handlers and Server Actions. In a Server Component render, cookies().set()
// throws ReadonlyRequestCookiesError (verified against Next 16:
// dist/server/web/spec-extension/adapters/request-cookies.js), so the write is
// skipped there — the middleware (hard navigations) and the Axios interceptor
// (XHR refreshes) cover those cases.
//
// Returns true when the cookie was written, false otherwise. Never throws.
export async function persistNewAccessToken(newAccessToken) {
  if (!newAccessToken) return false;
  try {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIES.access, newAccessToken, accessCookieOpts());
    return true;
  } catch {
    return false;
  }
}
