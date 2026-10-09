/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

// ─── CSP: Report-Only (monitoring mode, not enforcement) ──────────────────────
//
// Discovery was performed against the full source tree before authoring this policy.
//
// Known external origins included in policy:
//   - www.youtube.com          : YouTube IFrame API (iframe_api) + <iframe> embeds in LiveShow.jsx
//                                + YouTube provider in VideoPlayer (nocookie iframe + api loader)
//   - i.ytimg.com              : YouTube thumbnail images for admin/video previews
//   - blob:                    : HLS.js creates blob: URL workers for video playback
//   - NEXT_PUBLIC_IDRIVE_ENDPOINT (connect-src) :
//       iDrive/S3-compatible presigned URLs go directly from the browser to this
//       endpoint. The host is read from the env var at Next.js build/start time.
//       If the env var is absent (e.g. in CI), connect-src falls back to 'self'.
//
// next/font/google (Geist, Geist_Mono) downloads fonts at BUILD TIME and serves
// them from /_next/static/. No browser request to fonts.googleapis.com is made.
//
// A PWA web app manifest is served by src/app/manifest.js (manifest-src 'self').
//
// 'unsafe-inline' on script-src and style-src is required by Next.js internals
// (inline hydration scripts and CSS-in-JS). It will remain until a nonce-based
// approach is adopted.
//
// CSP Reporting:
//   TODO: Once a reporting endpoint exists (e.g. /api/csp-report or a third-party
//   service such as report-uri.com), add:
//     report-uri /api/csp-report
//   and the structured `report-to` group header.
//   Until then, violations are visible only in the browser DevTools console.
//
// Migration path: once CSP violations stabilise to zero in report-only mode,
// change the header name to 'Content-Security-Policy' to enforce.

// Derive the iDrive storage host from the environment variable so that
// connect-src never uses a wildcard but still allows presigned URL fetches.
let storageConnectSrc = "";
const idriveEndpoint = process.env.NEXT_PUBLIC_IDRIVE_ENDPOINT?.trim();
if (idriveEndpoint) {
  try {
    const { origin } = new URL(idriveEndpoint);
    storageConnectSrc = origin; // e.g. "https://f8939.your-objectstorage.com"
  } catch {
    // Malformed env var — fall back to 'self' only; TODO: fix NEXT_PUBLIC_IDRIVE_ENDPOINT
  }
}

const cspValue = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for hydration scripts.
  // The application loads YouTube's IFrame API for lecture recordings.
  // Do NOT use wildcards. Do NOT add 'unsafe-eval'. Prefer explicit origins or a future
  // nonce-based CSP migration.
  "script-src 'self' 'unsafe-inline' https://www.youtube.com",
  // CSS-in-JS and Next.js inline styles
  "style-src 'self' 'unsafe-inline'",
  // Self-hosted fonts (public/fonts/ + /_next/static/)
  "font-src 'self'",
  // Images: self + data: + blob: (canvas/object URLs) + YouTube thumbnails
  "img-src 'self' data: blob: https://i.ytimg.com",
  // Fetch/XHR/SSE: 'self' + iDrive endpoint for presigned uploads.
  `connect-src 'self'${storageConnectSrc ? ` ${storageConnectSrc}` : ""}`,
  // PWA manifest
  "manifest-src 'self'",
  // YouTube iframe embeds (lecture recordings).
  // youtube-nocookie.com included for Privacy Enhanced Mode support.
  // Origins must be unquoted in CSP — quoted hostnames are not valid source expressions.
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.zoom.us",
  // Blob workers (Next internals)
  "worker-src 'self' blob:",
  // Media playback inside embedded players
  "media-src 'self' blob:",
  // Prevent <base> tag hijacking
  "base-uri 'self'",
  // Prevent clickjacking via frame embedding
  "frame-ancestors 'none'",
  // Limit form targets
  "form-action 'self'",
  // Prevent Flash / PDF-plugin / <object> / <embed> injection
  "object-src 'none'",
  // Instruct browsers to upgrade HTTP sub-resource requests to HTTPS (production only)
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

// ─── Auth route cache-busting headers ─────────────────────────────────────────
// Applied only to /api/auth/* to prevent browsers and proxies from caching
// authentication responses (tokens, session cookies, error messages).
const authCacheHeaders = [
  { key: "Cache-Control", value: "no-store, must-revalidate" },
  { key: "Pragma",        value: "no-cache" },
  { key: "Expires",       value: "0" },
];

// ─── Global security headers ──────────────────────────────────────────────────
//
// Cookie prefix note:
//   __Host- cookies (e.g. __Host-access_token, __Host-s-i) intentionally NOT enabled.
//   Current deployment supports localhost development and existing live sessions.
//   __Host- requires Secure flag always, Path=/ with no Domain — breaking on HTTP.
//   Enable after a dedicated cookie-migration release where old sessions are
//   invalidated and the project is confirmed HTTPS-only across all environments.
//
// HSTS preload note:
//   'preload' is intentionally omitted from Strict-Transport-Security.
//   The project still supports localhost (HTTP) for development. Adding preload
//   would submit the domain to the browser preload list, making it impossible
//   to access over HTTP — breaking all development environments permanently.
//   Add preload only after the domain is confirmed HTTPS-only everywhere and
//   the team is prepared to submit to https://hstspreload.org.
const globalSecurityHeaders = [
  // HSTS: production only — localhost does not use HTTPS
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),

  // Prevents this site from being embedded in <iframe>/<frame>/<object>
  // (frame-ancestors in CSP above supersedes this for CSP-capable browsers)
  { key: "X-Frame-Options", value: "DENY" },

  // Prevents browsers from MIME-sniffing responses away from declared content-type
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Sends only origin (no path/query) on cross-origin requests;
  // full referrer on same-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Disable browser features not needed by this application.
  // fullscreen — allowed for self (HLS/HTMLVideoElement) and YouTube embeds.
  // Origins MUST be quoted strings per RFC 8941 (Structured Field Values).
  // Unquoted origins are silently rejected by Chrome, causing it to fall back
  // to treating the allowlist as just (self) — which never delegates fullscreen
  // to the YouTube iframe's origin, regardless of the iframe's own allow attr.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
      `fullscreen=(self "https://www.youtube-nocookie.com" "https://www.youtube.com")`,
    ].join(", "),
  },

  // CSP in report-only mode — violations logged but not blocked
  { key: "Content-Security-Policy-Report-Only", value: cspValue },
];

// Derive the iDrive storage hostname for next/image remotePatterns.
// Same env var used in lib/import/images/uploadImageBuffer.js and elsewhere.
const storageHostname = (() => {
  const ep = process.env.NEXT_PUBLIC_IDRIVE_ENDPOINT?.trim();
  if (ep) {
    try {
      return new URL(ep).hostname;
    } catch {}
  }
  return null;
})();

const nextConfig = {
  ...(storageHostname ? {
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: storageHostname,
        },
      ],
    },
  } : {}),
  async headers() {
    return [
      // ── Global security headers on every response ──────────────────────────
      {
        source: "/(.*)",
        headers: globalSecurityHeaders,
      },

      // ── Auth cache-busting: only on /api/auth/* ────────────────────────────
      {
        source: "/api/auth/:path*",
        headers: authCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
