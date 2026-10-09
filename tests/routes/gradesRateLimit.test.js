import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsRateLimited = vi.fn();
vi.mock("../../lib/isRateLimited", () => ({
  isRateLimited: (...args) => mockIsRateLimited(...args),
}));

import { checkRouteRateLimit } from "../../lib/routeRateLimit";

function makeReq(ip = "1.2.3.4") {
  return {
    headers: { get: (k) => (k === "x-forwarded-for" ? ip : null) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("grades route rate limit", () => {
  it("raises the grades preset above legitimate dashboard fan-out", async () => {
    mockIsRateLimited.mockResolvedValue(false);

    await checkRouteRateLimit(makeReq(), "grades");

    // limit is forwarded to the existing limiter (window stays 600s there)
    expect(mockIsRateLimited).toHaveBeenCalledWith(
      "route:grades",
      "1.2.3.4",
      300
    );
  });

  it("rate limiting remains enabled for grades (429 still reachable)", async () => {
    mockIsRateLimited.mockResolvedValue(true);

    const limited = await checkRouteRateLimit(makeReq(), "grades");

    expect(limited).toBe(true);
  });

  it("unknown route keys stay fail-open (unchanged behavior)", async () => {
    const limited = await checkRouteRateLimit(makeReq(), "nope");

    expect(limited).toBe(false);
    expect(mockIsRateLimited).not.toHaveBeenCalled();
  });
});
