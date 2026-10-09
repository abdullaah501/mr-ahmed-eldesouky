import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// TTL-propagation contract for the AI caches: setExtraction/setGeneration
// must hand the storage adapter an explicit expires value (AI_EXTRACTION_
// CACHE_TTL / 3600) and pass logical keys through unchanged — tenant
// prefixing is exclusively the lib/redis facade's job.

const holder = vi.hoisted(() => ({
  adapter: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    add: vi.fn(async () => true),
    increment: vi.fn(async () => 1),
    delete: vi.fn(async () => true),
  },
}));

vi.mock("../../lib/storage/MemcachedAdapter", () => ({
  createMemcachedAdapter: () => holder.adapter,
}));

describe("AI cache TTL propagation", () => {
  const ORIGINAL_TTL = process.env.AI_EXTRACTION_CACHE_TTL;

  beforeEach(() => {
    vi.clearAllMocks();
    holder.adapter.get.mockClear();
    holder.adapter.set.mockClear();
  });

  afterEach(async () => {
    if (ORIGINAL_TTL === undefined) delete process.env.AI_EXTRACTION_CACHE_TTL;
    else process.env.AI_EXTRACTION_CACHE_TTL = ORIGINAL_TTL;
    globalThis.__eduRedisClient = undefined;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function loadCaches() {
    globalThis.__eduRedisClient = undefined;
    vi.resetModules();
    const extraction = await import("../../lib/ai/cache/extractionCache");
    const generation = await import("../../lib/ai/cache/generationCache");
    const defaults = await import("../../lib/ai/config/defaults");
    return { extraction, generation, defaults };
  }

  it("setExtraction passes the configured extraction TTL to storage", async () => {
    const { extraction, defaults } = await loadCaches();

    await extraction.setExtraction("ai:ext:testkey", { context: { subject: "math" } });

    expect(holder.adapter.set).toHaveBeenCalledWith(
      "ai:ext:testkey",
      JSON.stringify({ context: { subject: "math" } }),
      { expires: defaults.AI_DEFAULTS.cache.extractionTtlSeconds }
    );
    expect(defaults.AI_DEFAULTS.cache.extractionTtlSeconds).toBeGreaterThan(0);
  });

  it("extraction TTL follows AI_EXTRACTION_CACHE_TTL from the environment", async () => {
    process.env.AI_EXTRACTION_CACHE_TTL = "1234";
    const { extraction } = await loadCaches();

    await extraction.setExtraction("ai:ext:testkey", { context: {} });

    expect(holder.adapter.set).toHaveBeenCalledWith(
      "ai:ext:testkey",
      expect.any(String),
      { expires: 1234 }
    );
  });

  it("getExtraction round-trips JSON through storage", async () => {
    const { extraction } = await loadCaches();

    holder.adapter.set.mockImplementationOnce(async (key, value) => {
      holder.adapter.get.mockResolvedValueOnce(value);
    });

    await extraction.setExtraction("ai:ext:roundtrip", { context: { a: 1 } });
    const cached = await extraction.getExtraction("ai:ext:roundtrip");

    expect(cached).toEqual({ context: { a: 1 } });
    expect(holder.adapter.get).toHaveBeenCalledWith("ai:ext:roundtrip");
  });

  it("setGeneration passes a 3600s TTL and an ai:gen logical key", async () => {
    const { generation } = await loadCaches();
    const { buildGenerationKey } = generation;
    const { key } = buildGenerationKey({
      normalizedInput: "lesson text",
      promptVersion: "v1",
      schemaVersion: 1,
      providerId: "google",
      modelId: "gemini",
    });

    await generation.setGeneration(key, { draft: [] });

    expect(holder.adapter.set).toHaveBeenCalledWith(
      key,
      expect.any(String),
      { expires: 3600 }
    );
    expect(key.startsWith("ai:gen:")).toBe(true);
  });

  it("consumers pass logical keys unchanged (no double prefixing)", async () => {
    const { extraction } = await loadCaches();
    const { buildKey } = extraction;
    const { key } = buildKey({ normalizedInput: "hello" });

    await extraction.setExtraction(key, { context: {} });

    // The consumer hands the logical ai:ext:<hash> key to storage as-is;
    // tenant:<TENANT_ID>: prefixing happens only inside lib/redis.js.
    expect(key.startsWith("ai:ext:")).toBe(true);
    expect(holder.adapter.set).toHaveBeenCalledWith(
      key,
      expect.any(String),
      expect.objectContaining({ expires: expect.any(Number) })
    );
  });
});
