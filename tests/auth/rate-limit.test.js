import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsRateLimited = vi.fn();
vi.mock("../../lib/isRateLimited", () => ({ isRateLimited: (...a) => mockIsRateLimited(...a) }));

import { checkRouteRateLimit } from "../../lib/routeRateLimit";

describe("route rate limiter", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("RL1: login rate limit hit returns true", async () => {
    mockIsRateLimited.mockResolvedValue(true);
    const req = { headers: { get: () => "1.2.3.4" } };
    const result = await checkRouteRateLimit(req, "login");
    expect(result).toBe(true);
    expect(mockIsRateLimited).toHaveBeenCalledWith("route:login", "1.2.3.4", 5);
  });

  it("RL2: under login limit returns false", async () => {
    mockIsRateLimited.mockResolvedValue(false);
    const req = { headers: { get: () => "1.2.3.4" } };
    const result = await checkRouteRateLimit(req, "login");
    expect(result).toBe(false);
  });

  it("RL3: refresh rate limit uses correct config", async () => {
    mockIsRateLimited.mockResolvedValue(false);
    const req = { headers: { get: () => "1.2.3.4" } };
    await checkRouteRateLimit(req, "refresh");
    expect(mockIsRateLimited).toHaveBeenCalledWith("route:refresh", "1.2.3.4", 30);
  });

  it("RL4: unknown route returns false (no rate limiting)", async () => {
    mockIsRateLimited.mockResolvedValue(true);
    const req = { headers: { get: () => "1.2.3.4" } };
    const result = await checkRouteRateLimit(req, "unknown");
    expect(result).toBe(false);
    expect(mockIsRateLimited).not.toHaveBeenCalled();
  });

  it("RL5: handles missing x-forwarded-for gracefully", async () => {
    const req = { headers: { get: () => null } };
    const result = await checkRouteRateLimit(req, "login");
    expect(typeof result).toBe("boolean");
  });
});
