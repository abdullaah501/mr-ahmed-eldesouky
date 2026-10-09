import { getMemcachedClient } from "../memcachedClient";
import redis from "../redis";
import { createRedisStorageAdapter } from "./RedisStorageAdapter";

// Storage backend selector (Memcached → Redis migration).
//
// When REDIS_URL is configured, all storage goes through the tenant-aware
// Redis facade (tenant:<TENANT_ID>:<logical-key>) via RedisStorageAdapter.
// The original Memcached/MemCachier implementation is kept intact as the
// rollback path and is removed in a later cleanup phase.
//
// Consumers keep calling createMemcachedAdapter() — the storage contract
// (get/set/add/increment/delete) and their fail-open/fail-closed semantics
// are identical across both backends.

export function createMemcachedAdapter() {
  if (process.env.REDIS_URL) {
    return createRedisStorageAdapter(redis);
  }
  return createMemcachedBackend();
}

function createMemcachedBackend() {
  const client = getMemcachedClient();

  return {
    async get(key) {
      if (!client) return null;

      try {
        const { value } = await client.get(key);
        return value ? value.toString() : null;
      } catch (err) {
        console.warn("Memcached get error:", err.message);
        return null;
      }
    },

    async set(key, value, options = {}) {
      if (!client) throw new Error("Memcached client is not available");
      try {
        await client.set(key, value, { expires: options.expires || 0 });
      } catch (err) {
        console.warn("Memcached set error:", err.message);
      }
    },

    async add(key, value, options = {}) {
      if (!client) throw new Error("Memcached client is not available");
      try {
        const success = await client.add(key, value, { expires: options.expires || 0 });
        return success;
      } catch (err) {
        if (err && err.message && err.message.includes("NOT_STORED")) {
          return false;
        }
        console.warn("Memcached add error:", err.message);
        return false;
      }
    },

    async increment(key, amount = 1, options = {}) {
      if (!client) return null;
      const expires = options.expires || 0;
      const initial = options.initial !== undefined ? options.initial : amount;

      const _rawIncrement = () =>
        new Promise((resolve, reject) => {
          client.increment(key, amount, { expires }, (err, success, value) => {
            if (err) return reject(err);
            if (!success || value === null || value === undefined)
              return resolve(null);
            resolve(value);
          });
        });

      try {
        const result = await _rawIncrement();

        if (result !== null) return result;

        // Key doesn't exist yet — atomically initialize it.
        // Use add() so only one concurrent caller wins initialization.
        const added = await client.add(key, String(initial), { expires });
        if (added) return initial;

        // Another request won the add race — join their window.
        const retried = await _rawIncrement();
        return retried;
      } catch (err) {
        console.warn("Memcached increment error:", err.message);
        return null;
      }
    },

    async delete(key) {
      if (!client) return false;
      try {
        await client.delete(key);
        return true;
      } catch (err) {
        return false;
      }
    },
  };
}
