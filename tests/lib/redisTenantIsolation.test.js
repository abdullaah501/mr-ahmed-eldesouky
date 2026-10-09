import { describe, it, expect, vi, afterEach } from "vitest";

// Pure key-isolation tests. No live Redis and no module mocks: the tenant
// prefix logic (resolveRedisKey) and facade delegation are exercised against
// a fake underlying client, so physical keys are observable deterministically.

describe("redis tenant key isolation", () => {
  const ORIGINAL_URL = process.env.REDIS_URL;
  const ORIGINAL_TENANT = process.env.TENANT_ID;

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = ORIGINAL_URL;
    if (ORIGINAL_TENANT === undefined) delete process.env.TENANT_ID;
    else process.env.TENANT_ID = ORIGINAL_TENANT;
    globalThis.__eduRedisClient = undefined;
    vi.restoreAllMocks();
  });

  async function loadIsolated() {
    delete process.env.REDIS_URL; // guarantee no real client is created
    globalThis.__eduRedisClient = undefined;
    vi.resetModules();
    return import("../../lib/redis");
  }

  function fakeUnderlying() {
    return {
      ping: vi.fn(async () => "PONG"),
      get: vi.fn(async () => "v"),
      set: vi.fn(async () => "OK"),
      del: vi.fn(async () => 1),
      ttl: vi.fn(async () => 60),
      expire: vi.fn(async () => 1),
      incrBy: vi.fn(async () => 1),
      quit: vi.fn(async () => "OK"),
      destroy: vi.fn(),
    };
  }

  it("prefixes logical keys with the tenant namespace", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();

    expect(mod.resolveRedisKey("ai:budget:global:2026-08")).toBe(
      "tenant:teacher_123:ai:budget:global:2026-08"
    );
  });

  it("generates different physical keys for different tenants", async () => {
    process.env.TENANT_ID = "teacher_123";
    const a = await loadIsolated();
    const keyA = a.resolveRedisKey("ai:budget:global:2026-08");

    process.env.TENANT_ID = "teacher_456";
    const b = await loadIsolated();
    const keyB = b.resolveRedisKey("ai:budget:global:2026-08");

    expect(keyA).toBe("tenant:teacher_123:ai:budget:global:2026-08");
    expect(keyB).toBe("tenant:teacher_456:ai:budget:global:2026-08");
    expect(keyA).not.toBe(keyB);
  });

  it("does not double-prefix already-namespaced keys of the same tenant", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const physical = "tenant:teacher_123:ai:budget:global:2026-08";

    expect(mod.resolveRedisKey(physical)).toBe(physical);
  });

  it("blocks access to another tenant's namespace", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    expect(() =>
      facade.get("tenant:teacher_456:ai:budget:global:2026-08")
    ).toThrow(/cross-tenant/);
    expect(fake.get).not.toHaveBeenCalled();
    expect(() =>
      mod.resolveRedisKey("tenant:teacher_456:ai:budget:global:2026-08")
    ).toThrow(/cross-tenant/);
  });

  it("maps GET / INCRBY (legacy name) / EXPIRE through the tenant prefix", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await facade.get("ai:budget:global:2026-08");
    await facade.incrby("ai:budget:global:2026-08", 3);
    await facade.expire("ai:budget:global:2026-08", 32 * 86_400);

    expect(fake.get).toHaveBeenCalledWith(
      "tenant:teacher_123:ai:budget:global:2026-08"
    );
    expect(fake.incrBy).toHaveBeenCalledWith(
      "tenant:teacher_123:ai:budget:global:2026-08",
      3
    );
    expect(fake.expire).toHaveBeenCalledWith(
      "tenant:teacher_123:ai:budget:global:2026-08",
      32 * 86_400
    );
  });

  it("prefixes every key of a multi-key delete (variadic and array forms)", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await facade.del("a", "b");
    await facade.del(["c", "d"]);

    expect(fake.del).toHaveBeenNthCalledWith(
      1,
      "tenant:teacher_123:a",
      "tenant:teacher_123:b"
    );
    expect(fake.del).toHaveBeenNthCalledWith(
      2,
      "tenant:teacher_123:c",
      "tenant:teacher_123:d"
    );
  });

  it("refuses to resolve keys when TENANT_ID is missing", async () => {
    delete process.env.TENANT_ID;
    const mod = await loadIsolated();

    expect(() => mod.resolveRedisKey("ai:budget:global:2026-08")).toThrow(
      /TENANT_ID is required/
    );
  });

  it("refuses to resolve keys when TENANT_ID contains invalid characters", async () => {
    process.env.TENANT_ID = "bad tenant:id";
    const mod = await loadIsolated();

    expect(() => mod.resolveRedisKey("ai:budget:global:2026-08")).toThrow(
      /invalid characters/
    );
  });
});
