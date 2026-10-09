import { describe, it, expect, beforeEach } from "vitest";
import { registerOutputTarget, resolveOutputTarget, listOutputTargets, clearOutputTargets } from "../../lib/ai/outputTargets/registry";
import { makeMockOutputTarget } from "./helpers/mockImportEngine";

beforeEach(() => {
  clearOutputTargets();
});

describe("outputTargets registry", () => {
  it("registers and resolves a target", () => {
    const t = makeMockOutputTarget({ id: "test" });
    registerOutputTarget(t);
    expect(resolveOutputTarget("test")).toBe(t);
    expect(listOutputTargets().map((x) => x.id)).toContain("test");
  });

  it("rejects target without write()", () => {
    expect(() => registerOutputTarget({ id: "x" })).toThrow();
  });

  it("rejects target without id", () => {
    expect(() => registerOutputTarget({ write() {} })).toThrow();
  });

  it("mock target uses new write({artifact, metadata, options}) signature", async () => {
    const t = makeMockOutputTarget({ id: "mock" });
    registerOutputTarget(t);
    const result = await t.write({
      artifact: { type: "canonical-json", data: {} },
      metadata: { userId: "u1", requestId: "r1" },
      options: { dryRun: true },
    });
    expect(result.ok).toBe(true);
    expect(result.target).toBe("mock");
    expect(t._calls[0].metadata.userId).toBe("u1");
    expect(t._calls[0].options.dryRun).toBe(true);
  });
});