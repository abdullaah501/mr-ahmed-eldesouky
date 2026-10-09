import { describe, it, expect, beforeEach } from "vitest";
import { resetAll, recordSuccess, recordFailure, trip, allow, inspect, reset } from "../../lib/ai/core/circuitBreaker";

beforeEach(() => {
  resetAll();
});

describe("circuitBreaker", () => {
  it("allows when closed", () => {
    expect(allow("p")).toBe(true);
  });

  it("opens after threshold consecutive failures", () => {
    for (let i = 0; i < 4; i++) recordFailure("p");
    expect(allow("p")).toBe(false);
    const s = inspect("p");
    expect(s.circuitOpen).toBe(true);
  });

  it("resets to closed on success", () => {
    for (let i = 0; i < 4; i++) recordFailure("p");
    recordSuccess("p");
    expect(allow("p")).toBe(true);
    expect(inspect("p").healthy).toBe(true);
  });

  it("trip() forces a trip", () => {
    trip("p", { cooldownMs: 1000 });
    expect(allow("p")).toBe(false);
    expect(inspect("p").circuitOpen).toBe(true);
  });

  it("cooldown expires → half-open allowed", async () => {
    trip("p", { cooldownMs: 10 });
    await new Promise((r) => setTimeout(r, 20));
    expect(allow("p")).toBe(true);
    expect(inspect("p").status).toBe("half-open");
  });

  it("half-open failure re-opens", async () => {
    trip("p", { cooldownMs: 10 });
    await new Promise((r) => setTimeout(r, 20));
    allow("p");
    recordFailure("p");
    expect(allow("p")).toBe(false);
  });

  it("reset() clears state", () => {
    for (let i = 0; i < 4; i++) recordFailure("p");
    reset("p");
    expect(allow("p")).toBe(true);
  });
});