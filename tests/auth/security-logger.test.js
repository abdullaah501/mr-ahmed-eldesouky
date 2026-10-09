import { describe, it, expect } from "vitest";
import { logSecurityEvent, SEC } from "../../lib/securityLogger";

describe("security logger", () => {
  it("L1: never throws on any input", () => {
    expect(() => logSecurityEvent()).not.toThrow();
    expect(() => logSecurityEvent(null)).not.toThrow();
    expect(() => logSecurityEvent("TEST", {})).not.toThrow();
    expect(() => logSecurityEvent("TEST", { userId: "u1" })).not.toThrow();
    expect(() => logSecurityEvent("TEST", { password: "secret" })).not.toThrow();
  });

  it("L2: all event constants are exported", () => {
    const events = Object.values(SEC);
    expect(events.length).toBeGreaterThanOrEqual(12);
    events.forEach((e) => expect(typeof e).toBe("string"));
  });

  it("L3: sanitizes sensitive fields from meta", () => {
    const output = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => { output.push(chunk); return true; };
    logSecurityEvent("TEST", { userId: "u1", password: "secret", creditCard: "4111" });
    process.stdout.write = origWrite;
    expect(output.length).toBe(1);
    const parsed = JSON.parse(output[0]);
    expect(parsed.event).toBe("TEST");
    expect(parsed.meta.userId).toBe("u1");
    expect(parsed.meta.password).toBeUndefined();
    expect(parsed.meta.creditCard).toBeUndefined();
  });
});
