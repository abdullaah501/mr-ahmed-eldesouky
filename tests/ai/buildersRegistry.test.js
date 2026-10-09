import { describe, it, expect, beforeEach } from "vitest";
import { registerBuilder, resolveBuilder, listBuilders, clearBuilders } from "../../lib/ai/workflows/canonicalJsonBuild/builders/registry";

beforeEach(() => {
  clearBuilders();
});

describe("builders registry", () => {
  it("registers and resolves a builder", () => {
    const b = { id: "test", build() { return {}; } };
    registerBuilder(b);
    expect(resolveBuilder("test")).toBe(b);
    expect(listBuilders()).toContain("test");
  });

  it("rejects builder without build()", () => {
    expect(() => registerBuilder({ id: "x" })).toThrow();
  });

  it("repository builder is registered via bootstrap", async () => {
    await import("../../lib/ai/workflows/canonicalJsonBuild/builders");
    expect(resolveBuilder("repository")).toBeTruthy();
  });
});