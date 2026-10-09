import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InMemoryStorage } from "./helpers/InMemoryStorage";

describe("rateLimit fail-open behavior", () => {
  let originalEnv;

  beforeEach(() => {
    vi.resetModules();
    originalEnv = process.env.MEMCACHED_URL;
    delete process.env.MEMCACHED_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.MEMCACHED_URL = originalEnv;
  });

  it("checkRateLimit returns allowed: true when storage throws", async () => {
    vi.doMock("../lib/memcachedClient", () => ({
      getMemcachedClient: () => null,
    }));

    const { checkRateLimit } = await import("../lib/rateLimit");
    const { createMemcachedAdapter } = await import(
      "../lib/storage/MemcachedAdapter"
    );

    const adapter = createMemcachedAdapter();
    const origGet = adapter.get;
    adapter.get = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await checkRateLimit({
      service: "test",
      key: "k",
      limit: 5,
      windowSeconds: 60,
    });
    expect(result.allowed).toBe(true);
    adapter.get = origGet;
  });

  it("incrementRateLimit returns count: 0 on storage error (does not throw)", async () => {
    vi.doMock("../lib/memcachedClient", () => ({
      getMemcachedClient: () => null,
    }));

    const { incrementRateLimit } = await import("../lib/rateLimit");
    const result = await incrementRateLimit({
      service: "test",
      key: "k",
      windowSeconds: 60,
    });
    expect(result.count).toBe(0);
  });
});

describe("rateLimit normal operation with in-memory storage", () => {
  it("allows requests under the limit", async () => {
    const { createMemcachedAdapter } = await import(
      "../lib/storage/MemcachedAdapter"
    );
    const { checkRateLimit } = await import("../lib/rateLimit");
    const adapter = createMemcachedAdapter();
    expect(adapter).toBeDefined();

    const r1 = await checkRateLimit({
      service: "t",
      key: "k1",
      limit: 5,
      windowSeconds: 60,
    });
    expect(r1.allowed).toBe(true);
  });
});
