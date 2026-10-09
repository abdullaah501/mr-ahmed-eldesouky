import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "redis";

// Live check against the internal Redis. Runs only where REDIS_URL and a
// valid TENANT_ID point at a reachable instance (staging/production
// validation); skipped in normal local runs where no Redis container exists.

const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const enabled =
  Boolean(process.env.REDIS_URL) &&
  TENANT_ID_PATTERN.test(process.env.TENANT_ID || "");

const mod = enabled ? await import("../../lib/redis") : null;
const client = mod?.default ?? null;
const tenantId = process.env.TENANT_ID;
const otherTenant = tenantId === "teacher_123" ? "teacher_456" : "teacher_123";

// Test-only raw connection, used solely to verify physical key namespacing
// (including that other tenants' namespaces stay empty). It never touches
// Bull/HLS data and issues no wildcard or destructive commands.
let rawClient = null;
if (client) {
  rawClient = createClient({ url: process.env.REDIS_URL });
  await rawClient.connect();
}

async function waitForReady(fn, timeoutMs = 10_000) {
  const start = Date.now();
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (Date.now() - start > timeoutMs) throw err;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

describe.skipIf(!client)("internal Redis integration (tenant-isolated)", () => {
  const logical = `migration:selftest:${Date.now()}`;

  afterAll(async () => {
    try {
      await client?.del(logical);
    } catch {}
    try {
      await client?.quit();
    } catch {}
    try {
      await rawClient?.quit();
    } catch {}
  });

  it("responds to PING", async () => {
    expect(await waitForReady(() => client.ping())).toBe("PONG");
  });

  it("stores logical keys under the tenant namespace", async () => {
    const physical = mod.resolveRedisKey(logical);
    expect(physical).toBe(`tenant:${tenantId}:${logical}`);

    await client.set(logical, "v1");

    // Readable under both the logical and the exact physical key.
    expect(await client.get(logical)).toBe("v1");
    expect(await client.get(physical)).toBe("v1");
  });

  it("INCRBY / EXPIRE / TTL operate on the tenant namespace", async () => {
    await client.del(logical);
    expect(await client.incrby(logical, 2)).toBe(2);
    expect(await client.incrby(logical, 3)).toBe(5);
    await client.expire(logical, 60);
    const ttl = await client.ttl(logical);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("another tenant's namespace cannot see this instance's keys", async () => {
    const physical = mod.resolveRedisKey(logical);
    const otherKey = `tenant:${otherTenant}:${logical}`;
    expect(await rawClient.exists(physical)).toBe(1);
    expect(await rawClient.exists(otherKey)).toBe(0);
  });

  it("GET on a missing key returns null (budgetStore fail-open contract)", async () => {
    expect(await client.get("migration:selftest:missing")).toBeNull();
  });

  describe("RedisStorageAdapter against live Redis", () => {
    const adapterLogical = `migration:selftest-adapter:${Date.now()}`;
    const rateLimitLogical = `migration:selftest-rl:${Date.now()}`;
    let adapterPhysical;
    let rateLimitPhysical;

    afterAll(async () => {
      try {
        await rawClient?.del(
          adapterPhysical,
          `${adapterPhysical}:start`,
          rateLimitPhysical,
          `${rateLimitPhysical}:start`
        );
      } catch {}
    });

    it("set/get round-trips and creates a tenant-prefixed physical key with TTL", async () => {
      const { createRedisStorageAdapter } = await import(
        "../../lib/storage/RedisStorageAdapter"
      );
      const adapter = createRedisStorageAdapter(client);
      adapterPhysical = mod.resolveRedisKey(adapterLogical);

      await waitForReady(() => adapter.set(adapterLogical, "v1", { expires: 60 }));

      expect(await adapter.get(adapterLogical)).toBe("v1");
      expect(await rawClient.exists(adapterPhysical)).toBe(1);
      const ttl = await rawClient.ttl(adapterPhysical);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it("add is atomic: first call wins, second call loses", async () => {
      const { createRedisStorageAdapter } = await import(
        "../../lib/storage/RedisStorageAdapter"
      );
      const adapter = createRedisStorageAdapter(client);

      await expect(
        adapter.add(adapterLogical, "winner", { expires: 60 })
      ).resolves.toBe(false); // key exists from the previous test
      const fresh = `${adapterLogical}:add`;
      await expect(adapter.add(fresh, "1", { expires: 60 })).resolves.toBe(true);
      await expect(adapter.add(fresh, "2", { expires: 60 })).resolves.toBe(false);
      expect(await adapter.get(fresh)).toBe("1");
      await rawClient.del(mod.resolveRedisKey(fresh));
    });

    it("increment initializes with initial then INCRBYs with TTL refresh", async () => {
      const { createRedisStorageAdapter } = await import(
        "../../lib/storage/RedisStorageAdapter"
      );
      const adapter = createRedisStorageAdapter(client);
      const countKey = `${adapterLogical}:count`;
      await expect(
        adapter.increment(countKey, 1, { initial: 1, expires: 60 })
      ).resolves.toBe(1);
      await expect(
        adapter.increment(countKey, 1, { initial: 1, expires: 60 })
      ).resolves.toBe(2);
      const ttl = await rawClient.ttl(mod.resolveRedisKey(countKey));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
      await rawClient.del(mod.resolveRedisKey(countKey));
    });

    it("rate limiting works end-to-end with tenant-prefixed keys", async () => {
      const { checkRateLimit } = await import("../../lib/rateLimit");
      rateLimitPhysical = mod.resolveRedisKey(
        `rate-limit:migration-selftest:${rateLimitLogical}:count`
      );

      const first = await checkRateLimit({
        service: "migration-selftest",
        key: rateLimitLogical,
        limit: 2,
        windowSeconds: 60,
      });
      expect(first.allowed).toBe(true);

      await waitForReady(async () => {
        if ((await rawClient.exists(rateLimitPhysical)) !== 1) {
          throw new Error("count key not created yet");
        }
      });
      const ttl = await rawClient.ttl(rateLimitPhysical);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });
});
