import { describe, it, expect, vi, afterEach } from "vitest";

// Unit tests for the tenant-aware facade's Memcached-parity primitives
// (add / increment). Uses a fake underlying client so the exact physical
// keys and redis options are observable without a live Redis.

describe("lib/redis facade: add/increment primitives", () => {
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
      set: vi.fn(async () => "OK"), // SET NX succeeds by default
      incrBy: vi.fn(async () => 7),
      expire: vi.fn(async () => 1),
    };
  }

  function resetFake(fake) {
    fake.set.mockClear();
    fake.incrBy.mockClear();
    fake.expire.mockClear();
  }

  const NX_EX = (ttl) => ({ condition: "NX", expiration: { type: "EX", value: ttl } });

  it("add issues SET NX EX and returns true when the key is new", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await expect(facade.add("rate-limit:x:start", "1712345", { expires: 600 })).resolves.toBe(
      true
    );
    expect(fake.set).toHaveBeenCalledWith(
      "tenant:teacher_123:rate-limit:x:start",
      "1712345",
      NX_EX(600)
    );
  });

  it("add returns false when the key already exists (SET NX misses)", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    fake.set.mockResolvedValueOnce(null); // simulate key exists
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await expect(facade.add("otp:claim:x", "1", { expires: 300 })).resolves.toBe(false);
    expect(fake.set).toHaveBeenCalledWith(
      "tenant:teacher_123:otp:claim:x",
      "1",
      NX_EX(300)
    );
  });

  it("add without expires issues SET NX with no expiration", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await facade.add("k", "v");
    expect(fake.set).toHaveBeenCalledWith("tenant:teacher_123:k", "v", {
      condition: "NX",
    });
  });

  it("increment initializes a missing key with initial (no INCRBY)", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await expect(
      facade.increment("rate-limit:x:count", 1, { initial: 1, expires: 600 })
    ).resolves.toBe(1);
    expect(fake.set).toHaveBeenCalledWith(
      "tenant:teacher_123:rate-limit:x:count",
      "1",
      NX_EX(600)
    );
    expect(fake.incrBy).not.toHaveBeenCalled();
    expect(fake.expire).not.toHaveBeenCalled();
  });

  it("increment on an existing key uses INCRBY and refreshes TTL with NX", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    fake.set.mockResolvedValue(null); // key exists → SET NX misses
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await expect(
      facade.increment("otp:attempts:x", 1, { initial: 1, expires: 300 })
    ).resolves.toBe(7);
    expect(fake.incrBy).toHaveBeenCalledWith("tenant:teacher_123:otp:attempts:x", 1);
    expect(fake.expire).toHaveBeenCalledWith(
      "tenant:teacher_123:otp:attempts:x",
      300,
      "NX"
    );
  });

  it("increment does not refresh TTL when INCRBY fails (null)", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    fake.set.mockResolvedValue(null);
    fake.incrBy.mockResolvedValue(null);
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await expect(
      facade.increment("k", 1, { initial: 1, expires: 300 })
    ).resolves.toBeNull();
    expect(fake.expire).not.toHaveBeenCalled();
  });

  it("blocks cross-tenant keys through the primitives", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await expect(
      facade.add("tenant:teacher_456:otp:store:x", "1", { expires: 300 })
    ).rejects.toThrow(/cross-tenant/);
    await expect(
      facade.increment("tenant:teacher_456:rate-limit:a:count", 1, { initial: 1 })
    ).rejects.toThrow(/cross-tenant/);
    expect(fake.set).not.toHaveBeenCalled();
    expect(fake.incrBy).not.toHaveBeenCalled();
  });

  it("passes already-namespaced keys through unchanged (no double prefix)", async () => {
    process.env.TENANT_ID = "teacher_123";
    const mod = await loadIsolated();
    const fake = fakeUnderlying();
    resetFake(fake);
    const facade = mod.createRedisFacade(fake, mod.resolveRedisKey);

    await facade.add("tenant:teacher_123:otp:store:x", "1", { expires: 300 });
    expect(fake.set).toHaveBeenCalledWith(
      "tenant:teacher_123:otp:store:x",
      "1",
      NX_EX(300)
    );
  });
});
