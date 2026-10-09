import { NextResponse } from "next/server";

/**
 * validateOrigin — lightweight CSRF protection for state-changing auth routes.
 *
 * Contract:
 *   - If the Origin header is ABSENT → allow (mobile clients, curl, server-to-server
 *     callers often omit it; SameSite=Lax already blocks cross-site cookie submission).
 *   - If the Origin header IS present → its normalized origin (scheme + host + port)
 *     must exactly match the expected application origin derived from the request.
 *   - Mismatch → return 403 immediately.
 *
 * Origin comparison strategy:
 *   The expected origin is reconstructed from the request using:
 *     1. X-Forwarded-Proto  — set by Cloudflare, nginx, and other reverse proxies
 *     2. X-Forwarded-Host   — set by reverse proxies to carry the original host
 *     3. host header        — direct connection fallback
 *
 *   Both sides are parsed through `new URL()` so they are normalized identically
 *   (scheme lowercased, default ports stripped, e.g. :443 removed from https).
 *   This avoids false positives from case differences or redundant port numbers
 *   while correctly comparing scheme + host + port as a unit.
 *
 *   Supported environments:
 *     - localhost (http + http)
 *     - production (https + https)
 *     - Cloudflare (sets X-Forwarded-Proto: https, X-Forwarded-Host)
 *     - nginx reverse proxy (sets X-Forwarded-Proto, X-Forwarded-Host or Host)
 *
 * This is NOT a full CSRF token scheme. It is a defence-in-depth layer that catches
 * cross-origin form submissions from foreign origins that send an Origin header
 * (all modern browsers do on POST).
 *
 * @param {Request} req — the Next.js Route Handler Request object
 * @returns {NextResponse|null} — 403 response on mismatch, null if validation passes
 */
export function validateOrigin(req) {
  const originHeader = req.headers.get("origin");
  
  // No Origin header → allow (see contract above)
  if (!originHeader) return null;

  // ── Parse the incoming Origin header ──────────────────────────────────────
  let incomingOrigin;
  try {
    // new URL() normalises scheme, lowercases host, strips default ports
    incomingOrigin = new URL(originHeader).origin;
  } catch {
    // Malformed Origin header → reject
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // "null" origin (sandboxed iframes, data: URIs) — reject
  if (incomingOrigin === "null") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // ── Reconstruct the expected origin from the request context ──────────────
  //
  // Prefer X-Forwarded-Proto/Host because reverse proxies (Cloudflare, nginx)
  // replace the Host header with the internal upstream address but preserve the
  // original scheme and host in X-Forwarded-* headers.
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto?.split(",")[0].trim().toLowerCase() ||
    (req.url?.startsWith("https") ? "https" : "http");

  const forwardedHost = req.headers.get("x-forwarded-host");
  const host =
    forwardedHost?.split(",")[0].trim().toLowerCase() ||
    req.headers.get("host")?.trim().toLowerCase();

  if (!host) {
    // Cannot determine expected origin — reject to be safe
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let expectedOrigin;
  try {
    expectedOrigin = new URL(`${proto}://${host}`).origin;
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // ── Compare normalized origins ─────────────────────────────────────────────
  if (incomingOrigin !== expectedOrigin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return null;
}
