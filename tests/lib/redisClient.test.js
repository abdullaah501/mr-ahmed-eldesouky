import { describe, it, expect, vi, afterEach } from "vitest";

// Unit tests for the tenant-isolated Redis client module. No live Redis
// required: the client is constructed against a closed local port and must
// fail fast; configuration errors must refuse operations, never fall back
// to unscoped keys.

describe("lib/redis client", () => {
  const ORIGINAL_URL = process.env.REDIS_URL;
  const ORIGINAL_TENANT = process.env.TENANT_ID;

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = ORIGINAL_URL;
    if (ORIGINAL_TENANT === undefined) delete process.env.TENANT_ID;
    else process.env.TENANT_ID = ORIGINAL_TENANT;
    const client = globalThis.__eduRedisClient;
    if (client) {
      // destroy() force-closes without waiting for a connection — quit()
      // would hang on a client that never connected.
      try {
        client.destroy?.();
      } catch {}
    }
    globalThis.__eduRedisClient = undefined;
    vi.restoreAllMocks();
  });

  it("exports null and warns when REDIS_URL is not configured (fail-open)", async () => {
    delete process.env.REDIS_URL;
    const warnings = [];
    vi.spyOn(console, "warn").mockImplementation((m) => warnings.push(String(m)));
    vi.resetModules();

    const mod = await import("../../lib/redis");

    expect(mod.default).toBeNull();
    expect(
      warnings.some((w) => w.includes("REDIS_URL is not configured"))
    ).toBe(true);
  });

  it("exposes the consumer command surface (get/incrby/expire)", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6390"; // nothing listens here
    process.env.TENANT_ID = "teacher_123";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();

    const mod = await import("../../lib/redis");
    const client = mod.default;

    expect(client).not.toBeNull();
    expect(typeof client.get).toBe("function");
    expect(typeof client.incrby).toBe("function");
    expect(typeof client.expire).toBe("function");
  });

  it("rejects commands immediately while disconnected (no offline queue hang)", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6390"; // nothing listens here
    process.env.TENANT_ID = "teacher_123";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();

    const mod = await import("../../lib/redis");
    const client = mod.default;

    await expect(client.get("migration-selftest")).rejects.toThrow();
  });

  it("refuses operations when TENANT_ID is missing (no unscoped fallback)", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6390";
    delete process.env.TENANT_ID;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();

    const mod = await import("../../lib/redis");
    const client = mod.default;

    expect(() => client.get("ai:budget:global:2026-08")).toThrow(
      /TENANT_ID is required/
    );
    expect(() => client.incrby("ai:budget:global:2026-08", 1)).toThrow(
      /TENANT_ID is required/
    );
    expect(() => client.expire("ai:budget:global:2026-08", 60)).toThrow(
      /TENANT_ID is required/
    );
    expect(() => mod.resolveRedisKey("ai:budget:global:2026-08")).toThrow(
      /TENANT_ID is required/
    );
  });

  it("refuses operations when TENANT_ID contains invalid characters", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6390";
    process.env.TENANT_ID = "bad:tenant id";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();

    const mod = await import("../../lib/redis");
    const client = mod.default;

    expect(() => client.get("ai:budget:global:2026-08")).toThrow(
      /invalid characters/
    );
  });
});
