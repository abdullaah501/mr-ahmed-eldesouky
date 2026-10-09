import { createClient } from "redis";

// One shared client per process. The globalThis cache keeps Next.js dev
// hot-reload from re-evaluating this module into duplicate connections.
const globalForRedis = globalThis;

// Tenant namespace: every key is stored as tenant:<TENANT_ID>:<logical-key>.
// The pattern rejects ":" (namespace separator) and whitespace.
const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function logWarn(message) {
  console.warn(`[redis] ${message}`);
}

function tenantConfig() {
  const raw = process.env.TENANT_ID;
  if (!raw) {
    return {
      error:
        "TENANT_ID is required — Redis operations are refused (no unscoped fallback)",
    };
  }
  if (!TENANT_ID_PATTERN.test(raw)) {
    return {
      error:
        "TENANT_ID contains invalid characters (allowed: letters, numbers, '_', '-') — Redis operations are refused",
    };
  }
  return { tenantId: raw };
}

function createKeyResolver(tenantId) {
  const prefix = `tenant:${tenantId}`;
  return function resolveKey(key) {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("[redis] key must be a non-empty string");
    }
    // Already physical — the prefixing responsibility stays in one layer.
    if (key.startsWith(`${prefix}:`)) return key;
    // Another tenant's namespace is never readable from this instance.
    if (key.startsWith("tenant:")) {
      throw new Error("[redis] cross-tenant key access is blocked");
    }
    return `${prefix}:${key}`;
  };
}

// Facade over the native client: every key-taking command maps its key
// arguments through resolveKey. New Redis commands must be added here (and
// only here) so unscoped keys can never reach Redis. Lifecycle methods take
// no keys. Exported for tests; production code should use the default export.
export function createRedisFacade(client, resolveKey) {
  return {
    ping: (...args) => client.ping(...args),
    get: (key) => client.get(resolveKey(key)),
    set: (key, ...rest) => client.set(resolveKey(key), ...rest),
    del: (...args) => {
      const keys = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return client.del(...keys.map((key) => resolveKey(key)));
    },
    ttl: (key) => client.ttl(resolveKey(key)),
    expire: (key, ...rest) => client.expire(resolveKey(key), ...rest),
    // redis v6 generates camelCase command names (INCRBY -> incrBy); consumers
    // of this module use the Redis command name (incrby).
    incrby: (key, ...rest) => client.incrBy(resolveKey(key), ...rest),
    // Memcached-parity atomic primitives (Memcached → Redis migration):
    // add ≈ ADD / SET NX EX; increment ≈ binary INCR with initial+expires.
    add: async (key, value, options = {}) => {
      const ttl = options.expires || 0;
      const result = await client.set(
        resolveKey(key),
        value,
        ttl
          ? { condition: "NX", expiration: { type: "EX", value: ttl } }
          : { condition: "NX" }
      );
      return result === "OK";
    },
    increment: async (key, amount = 1, options = {}) => {
      const initial = options.initial !== undefined ? options.initial : amount;
      const ttl = options.expires || 0;
      const k = resolveKey(key);
      // Missing key initializes to `initial` (not initial+amount), mirroring
      // memcached's binary INCR-with-initial and the adapter test contract.
      const initialized = await client.set(
        k,
        String(initial),
        ttl
          ? { condition: "NX", expiration: { type: "EX", value: ttl } }
          : { condition: "NX" }
      );
      if (initialized === "OK") return initial;
      const next = await client.incrBy(k, amount);
      // Replicate memcached's TTL-refresh-on-increment (sliding window);
      // NX avoids re-arming a key another request just re-created.
      if (ttl && next !== null) {
        await client.expire(k, ttl, "NX").catch(() => {});
      }
      return next;
    },
    quit: (...args) => client.quit(...args),
    destroy: (...args) => client.destroy(...args),
  };
}

function createRefusingFacade(reason) {
  const refuse = () => {
    throw new Error(`[redis] ${reason}`);
  };
  return Object.fromEntries(
    [
      "ping",
      "get",
      "set",
      "del",
      "ttl",
      "expire",
      "incrby",
      "add",
      "increment",
      "quit",
      "destroy",
    ].map((method) => [method, refuse])
  );
}

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    logWarn("REDIS_URL is not configured — Redis-backed features fail open.");
    return null;
  }

  // A missing/invalid tenant is a configuration error, not an availability
  // problem: refuse every operation instead of writing unscoped keys.
  const { tenantId, error } = tenantConfig();
  if (error) {
    console.error(`[redis] ${error}`);
    return createRefusingFacade(error);
  }

  const resolveKey = createKeyResolver(tenantId);

  let lastErrorLogAt = 0;
  const warnThrottled = (message) => {
    const now = Date.now();
    if (now - lastErrorLogAt < 60_000) return;
    lastErrorLogAt = now;
    logWarn(message);
  };

  const client = createClient({
    url,
    // Commands issued while disconnected reject immediately instead of
    // queueing indefinitely — consumers decide the outcome (fail-open).
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 3_000,
      // Retry forever with capped backoff so a Redis restart is recovered
      // automatically without hammering the private network.
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  });

  // node-redis emits "error" on every failed attempt; without this handler a
  // failed connection would crash the process. Throttled so outages stay quiet.
  client.on("error", (err) => warnThrottled(err.message));
  client.on("ready", () => {
    lastErrorLogAt = 0;
    console.log(`[redis] connected (tenant: ${tenantId})`);
  });

  // Fire-and-forget: never block module evaluation or crash the process.
  client
    .connect()
    .catch((err) => warnThrottled(`connection failed: ${err.message}`));

  return createRedisFacade(client, resolveKey);
}

// Test/ops seam: the physical key the abstraction resolves for a logical key.
export function resolveRedisKey(key) {
  const { tenantId, error } = tenantConfig();
  if (error) throw new Error(`[redis] ${error}`);
  return createKeyResolver(tenantId)(key);
}

if (globalForRedis.__eduRedisClient === undefined) {
  globalForRedis.__eduRedisClient = createRedisClient();
}

export default globalForRedis.__eduRedisClient;
