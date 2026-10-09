import redis from "../redis";

// Redis-backed implementation of the StorageAdapter contract
// (see lib/storage/StorageAdapter.js and tests/helpers/InMemoryStorage.js).
//
// Error mapping mirrors lib/storage/MemcachedAdapter.js exactly so consumer
// fail-open/fail-closed semantics are preserved:
//   get       → null on any failure (fail-open read)
//   set       → throws only when no backend is available; server errors are
//               logged and swallowed
//   add       → throws when no backend is available; returns false otherwise
//   increment → null on any failure (consumers decide: rate limiting fails
//               open, OTP verification fails closed)
//   delete    → best-effort boolean
//
// Key namespacing is NOT handled here: every key flows through the
// tenant-aware facade in lib/redis.js (tenant:<TENANT_ID>:<logical-key>),
// which remains the single source of truth for isolation.

let warnedNoTtl = false;

function warnNoTtl(key) {
  if (warnedNoTtl) return;
  warnedNoTtl = true;
  console.warn(
    `[redis-storage] set/add without expires creates a never-expiring key (key: ${key}) — passing a TTL is strongly recommended`
  );
}

export function createRedisStorageAdapter(facade) {
  return {
    async get(key) {
      if (!facade) return null;
      try {
        const value = await facade.get(key);
        return value === undefined ? null : value;
      } catch (err) {
        console.warn("Redis get error:", err.message);
        return null;
      }
    },

    async set(key, value, options = {}) {
      if (!facade) {
        throw new Error("Redis storage is not available");
      }
      try {
        if (!options.expires) warnNoTtl(key);
        await facade.set(key, String(value), {
          expiration: options.expires
            ? { type: "EX", value: options.expires }
            : undefined,
        });
      } catch (err) {
        console.warn("Redis set error:", err.message);
      }
    },

    async add(key, value, options = {}) {
      if (!facade) {
        throw new Error("Redis storage is not available");
      }
      try {
        if (!options.expires) warnNoTtl(key);
        return await facade.add(key, String(value), { expires: options.expires || 0 });
      } catch (err) {
        console.warn("Redis add error:", err.message);
        return false;
      }
    },

    async increment(key, amount = 1, options = {}) {
      if (!facade) return null;
      try {
        return await facade.increment(key, amount, options);
      } catch (err) {
        console.warn("Redis increment error:", err.message);
        return null;
      }
    },

    async delete(key) {
      if (!facade) return false;
      try {
        // The facade exposes node-redis's command name (del); the storage
        // contract uses Memcached's name (delete).
        await facade.del(key);
        return true;
      } catch (err) {
        return false;
      }
    },
  };
}
