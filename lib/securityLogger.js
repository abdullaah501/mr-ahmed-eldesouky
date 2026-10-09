export const SEC = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  REFRESH_SUCCESS: "REFRESH_SUCCESS",
  REFRESH_FAILED: "REFRESH_FAILED",
  SESSION_REVOKED: "SESSION_REVOKED",
  JWT_SESSION_MISMATCH: "JWT_SESSION_MISMATCH",
  TOKEN_VERSION_MISMATCH: "TOKEN_VERSION_MISMATCH",
  ROLE_CHANGED: "ROLE_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  LOGOUT: "LOGOUT",
  SESSION_ROTATED: "SESSION_ROTATED",
  REFRESH_REPLAY_DETECTED: "REFRESH_REPLAY_DETECTED",
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  REGISTER_SUCCESS: "REGISTER_SUCCESS",
  VIDEO_MEMCACHED_UNAVAILABLE: "VIDEO_MEMCACHED_UNAVAILABLE",
  VIDEO_MEMCACHED_ERROR: "VIDEO_MEMCACHED_ERROR",
  VIDEO_DUPLICATE_SESSION_CLEANUP: "VIDEO_DUPLICATE_SESSION_CLEANUP",
};

const SAFE_KEYS = new Set([
  "userId",
  "sessionId",
  "role",
  "from",
  "to",
  "ip",
  "reason",
  "tokenVersion",
  "fingerprint",
  "duplicatesRemoved",
]);

function sanitize(meta) {
  if (!meta || typeof meta !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SAFE_KEYS.has(k) && v !== undefined && v !== null) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = v;
      } else {
        out[k] = String(v);
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function logSecurityEvent(event, meta) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      type: "security",
      event,
      meta: sanitize(meta),
    });
    process.stdout.write(line + "\n");
  } catch {
  }
}
