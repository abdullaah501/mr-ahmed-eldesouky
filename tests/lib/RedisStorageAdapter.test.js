import { describe, it, expect, vi, afterEach } from "vitest";

// Unit tests for the Redis-backed StorageAdapter. Covers the exact error
// mapping contract shared with MemcachedAdapter (fail-open reads, throws on
// unavailable backend for set/add, null-increment for fail-closed consumers)
// and the automatic tenant prefixing inherited from the lib/redis facade.

describe("RedisStorageAdapter", () => {
  const ORIGINAL_URL = process.env.REDIS_URL;
  const ORIGINAL_TENANT = process.env.TENANT_ID;

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = ORIGINAL_URL;
    if (ORIGINAL_TENANT === undefined) delete process.env.TENANT_ID;
    else process.env.TENANT_ID = ORIGINAL_TENANT;
    const client = globalThis.__eduRedisClient;
    if (client) {
      try {
        client.destroy?.();
      } catch {}
    }
    globalThis.__eduRedisClient = undefined;
    vi.restoreAllMocks();
  });

  async function loadIsolated() {
    delete process.env.REDIS_URL; // guarantee no real client is created
    globalThis.__eduRedisClient = undefined;
    vi.resetModules();
    return import("../../lib/storage/RedisStorageAdapter");
  }

  function fakeFacade() {
    return {
      get: vi.fn(async () => "v"),
      set: vi.fn(async () => "OK"),
      add: vi.fn(async () => true),
      increment: vi.fn(async () => 5),
      del: vi.fn(async () => "OK"), // facade exposes node-redis command names
    };
  }

  describe("unavailable backend (null facade)", () => {
    it("get returns null (fail-open read)", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const adapter = createRedisStorageAdapter(null);
      await expect(adapter.get("k")).resolves.toBeNull();
    });

    it("set throws", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const adapter = createRedisStorageAdapter(null);
      await expect(adapter.set("k", "v", { expires: 60 })).rejects.toThrow(
        /not available/
      );
    });

    it("add throws", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const adapter = createRedisStorageAdapter(null);
      await expect(adapter.add("k", "v", { expires: 60 })).rejects.toThrow(
        /not available/
      );
    });

    it("increment returns null (fail-closed consumers decide)", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const adapter = createRedisStorageAdapter(null);
      await expect(adapter.increment("k", 1, { initial: 1 })).resolves.toBeNull();
    });

    it("delete returns false", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const adapter = createRedisStorageAdapter(null);
      await expect(adapter.delete("k")).resolves.toBe(false);
    });
  });

  describe("available backend", () => {
    it("get returns the value and maps errors to null (fail-open)", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const facade = fakeFacade();
      const adapter = createRedisStorageAdapter(facade);

      await expect(adapter.get("k")).resolves.toBe("v");

      facade.get.mockRejectedValue(new Error("down"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(adapter.get("k")).resolves.toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it("set coerces values to strings and swallows server errors", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const facade = fakeFacade();
      const adapter = createRedisStorageAdapter(facade);

      await adapter.set("counter", 42, { expires: 600 });
      expect(facade.set).toHaveBeenCalledWith("counter", "42", {
        expiration: { type: "EX", value: 600 },
      });

      facade.set.mockRejectedValue(new Error("down"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(adapter.set("counter", "1", { expires: 600 })).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });

    it("set without expires stores without TTL and warns once", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const facade = fakeFacade();
      const adapter = createRedisStorageAdapter(facade);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await adapter.set("k", "v");
      expect(facade.set).toHaveBeenCalledWith("k", "v", { expiration: undefined });
      expect(warn).toHaveBeenCalledTimes(1);
      await adapter.set("k2", "v2");
      expect(warn).toHaveBeenCalledTimes(1); // throttled
    });

    it("add returns booleans and maps errors to false", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const facade = fakeFacade();
      const adapter = createRedisStorageAdapter(facade);

      await expect(adapter.add("fence", "1", { expires: 10 })).resolves.toBe(true);

      facade.add.mockResolvedValue(false);
      await expect(adapter.add("fence", "1", { expires: 10 })).resolves.toBe(false);

      facade.add.mockRejectedValue(new Error("down"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(adapter.add("fence", "1", { expires: 10 })).resolves.toBe(false);
      expect(warn).toHaveBeenCalled();
    });

    it("increment passes options through and maps errors to null", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const facade = fakeFacade();
      const adapter = createRedisStorageAdapter(facade);

      await expect(
        adapter.increment("attempts", 1, { initial: 1, expires: 300 })
      ).resolves.toBe(5);
      expect(facade.increment).toHaveBeenCalledWith("attempts", 1, {
        initial: 1,
        expires: 300,
      });

      facade.increment.mockRejectedValue(new Error("down"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(adapter.increment("attempts", 1)).resolves.toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it("delete is best-effort", async () => {
      const { createRedisStorageAdapter } = await loadIsolated();
      const facade = fakeFacade();
      const adapter = createRedisStorageAdapter(facade);

      await expect(adapter.delete("k")).resolves.toBe(true);

      facade.del.mockRejectedValue(new Error("down"));
      await expect(adapter.delete("k")).resolves.toBe(false);
    });
  });

  describe("tenant isolation through the facade", () => {
    it("routes every operation through tenant-prefixed keys", async () => {
      process.env.TENANT_ID = "eud-mr-talaat";
      const redisMod = await import("../../lib/redis");
      const { createRedisStorageAdapter } = await loadIsolated();

      // Stateful SET NX simulation: a key set once misses on later adds.
      const seen = new Set();
      const underlying = {
        get: vi.fn(async () => "v"),
        set: vi.fn(async (key) => {
          if (seen.has(key)) return null;
          seen.add(key);
          return "OK";
        }),
        add: vi.fn(async () => true),
        incrBy: vi.fn(async () => 3),
        expire: vi.fn(async () => 1),
        del: vi.fn(async () => 1), // node-redis command name
      };
      const facade = redisMod.createRedisFacade(underlying, redisMod.resolveRedisKey);
      const adapter = createRedisStorageAdapter(facade);

      await adapter.get("otp:store:abc");
      await adapter.set("otp:store:abc", "hash", { expires: 300 });
      await adapter.add("otp:fence:abc", "1", { expires: 10 });
      await adapter.increment("rate-limit:auth:x:count", 1, { initial: 1, expires: 600 });
      await adapter.increment("rate-limit:auth:x:count", 1, { initial: 1, expires: 600 });
      await adapter.delete("reset:token:abc");

      const p = (k) => `tenant:eud-mr-talaat:${k}`;
      expect(underlying.get).toHaveBeenCalledWith(p("otp:store:abc"));
      expect(underlying.set).toHaveBeenCalledWith(
        p("otp:store:abc"),
        "hash",
        { expiration: { type: "EX", value: 300 } }
      );
      expect(underlying.set).toHaveBeenCalledWith(
        p("rate-limit:auth:x:count"),
        "1",
        { condition: "NX", expiration: { type: "EX", value: 600 } }
      );
      // First increment initializes (no INCRBY); second one claims via INCRBY
      // and refreshes the TTL with NX (memcached sliding-window parity).
      expect(underlying.incrBy).toHaveBeenCalledTimes(1);
      expect(underlying.incrBy).toHaveBeenCalledWith(p("rate-limit:auth:x:count"), 1);
      expect(underlying.expire).toHaveBeenCalledWith(p("rate-limit:auth:x:count"), 600, "NX");
      expect(underlying.del).toHaveBeenCalledWith(p("reset:token:abc"));

      // The add() path (fence) hits the same namespace.
      expect(underlying.set).toHaveBeenCalledWith(p("otp:fence:abc"), "1", {
        condition: "NX",
        expiration: { type: "EX", value: 10 },
      });
    });

    it("cross-tenant keys fail closed without ever reaching Redis", async () => {
      process.env.TENANT_ID = "eud-mr-talaat";
      const redisMod = await import("../../lib/redis");
      const { createRedisStorageAdapter } = await loadIsolated();

      const underlying = {
        get: vi.fn(async () => null),
        set: vi.fn(async () => "OK"),
        add: vi.fn(async () => true),
        incrBy: vi.fn(async () => 1),
        delete: vi.fn(async () => 1),
      };
      const facade = redisMod.createRedisFacade(underlying, redisMod.resolveRedisKey);
      const adapter = createRedisStorageAdapter(facade);

      // The facade rejects cross-tenant access; the adapter maps those
      // rejections into its normal failure contract. The security property
      // under test: no command ever reaches Redis.
      await expect(adapter.get("tenant:other-tenant:otp:store:abc")).resolves.toBeNull();
      await expect(
        adapter.set("tenant:other-tenant:k", "v", { expires: 60 })
      ).resolves.toBeUndefined();
      await expect(
        adapter.add("tenant:other-tenant:k", "v", { expires: 60 })
      ).resolves.toBe(false);
      await expect(
        adapter.increment("tenant:other-tenant:k", 1, { initial: 1 })
      ).resolves.toBeNull();

      expect(underlying.get).not.toHaveBeenCalled();
      expect(underlying.set).not.toHaveBeenCalled();
      expect(underlying.incrBy).not.toHaveBeenCalled();
      expect(underlying.delete).not.toHaveBeenCalled();
    });
  });
});
