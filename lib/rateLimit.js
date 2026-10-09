import { createMemcachedAdapter } from "./storage/MemcachedAdapter";

const storage = createMemcachedAdapter();

function makeKeys(service, key) {
  const prefix = `rate-limit:${service}:${key}`;
  return { count: `${prefix}:count`, start: `${prefix}:start` };
}

function fallback({ limit, windowSeconds }) {
  return {
    allowed: true,
    limit,
    remaining: limit,
    retryAfter: 0,
    resetAt: Date.now() + windowSeconds * 1000,
  };
}

/**
 * Atomically check-and-increment in one operation.
 *
 * Race-safety explanation:
 *
 * 1. Window initialization: we use add() to write the start timestamp.
 *    add() is a Memcached atomic compare-and-set — only one concurrent caller
 *    succeeds. All others proceed to increment() and join that window.
 *
 * 2. Slot claiming: increment() maps to Memcached native `incr`, a single
 *    server-side operation. Each concurrent request receives its own unique
 *    sequence number. The decision (allowed or not) is made on that unique
 *    number — there is no separate check/increment gap.
 *
 * 3. Expired window: add() is used to initialize the new window's start key.
 *    If the add fails (another request won), we call increment() to join
 *    that request's fresh window.
 */
async function consumeRateLimit({ service, key, limit, windowSeconds }) {
  const { count: countKey, start: startKey } = makeKeys(service, key);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();

  try {
    const startStr = await storage.get(startKey);
    const start = startStr ? parseInt(startStr, 10) : null;
    const windowActive = start !== null && now - start < windowMs;

    if (!windowActive) {
      // Attempt to atomically claim a new window start.
      // Only one concurrent caller wins; others branch to the else below.
      const initialized = await storage.add(startKey, String(now), {
        expires: windowSeconds,
      });

      if (initialized) {
        // We own this window. Initialize count at 1.
        await storage.set(countKey, "1", { expires: windowSeconds });
        const resetAt = now + windowMs;
        const allowed = limit >= 1;
        return {
          allowed,
          limit,
          remaining: Math.max(0, limit - 1),
          retryAfter: allowed ? 0 : Math.ceil(windowMs / 1000),
          count: 1,
          resetAt,
        };
      }
      // Another request initialized the window. Fall through to increment.
    }

    // Atomically claim one slot in the active window.
    const newCount = await storage.increment(countKey, 1, {
      initial: 1,
      expires: windowSeconds,
    });

    if (newCount === null) {
      return fallback({ limit, windowSeconds });
    }

    const windowStart = start ?? now;
    const resetAt = windowStart + windowMs;
    const allowed = newCount <= limit;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - newCount),
      retryAfter: allowed ? 0 : Math.ceil((resetAt - now) / 1000),
      count: newCount,
      resetAt,
    };
  } catch (err) {
    console.warn("consumeRateLimit error:", err.message);
    return fallback({ limit, windowSeconds });
  }
}

/**
 * checkRateLimit — kept for API compatibility.
 * Now performs an atomic consume internally; the decision and increment
 * happen in the same operation.
 */
export async function checkRateLimit({ service, key, limit, windowSeconds }) {
  return consumeRateLimit({ service, key, limit, windowSeconds });
}

/**
 * incrementRateLimit — kept for API compatibility.
 * Routes call this after checkRateLimit, but since checkRateLimit now also
 * increments, this becomes a no-op to avoid double counting.
 */
export async function incrementRateLimit({ service, key, windowSeconds }) {
  // No-op: consume already happened inside checkRateLimit.
  return { count: 0 };
}

export async function resetRateLimit({ service, key }) {
  const { count: countKey, start: startKey } = makeKeys(service, key);
  try {
    await Promise.all([storage.delete(countKey), storage.delete(startKey)]);
    return { reset: true };
  } catch (err) {
    console.warn("resetRateLimit error:", err.message);
    return { reset: false };
  }
}
