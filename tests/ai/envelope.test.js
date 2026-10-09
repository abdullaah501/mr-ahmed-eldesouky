import { describe, it, expect } from "vitest";
import { wrapEnvelope, assertEnvelope, chainLineage } from "../../lib/ai/workflows/shared/envelope";

describe("ArtifactEnvelope", () => {
  it("wrapEnvelope produces a valid envelope with unique id", () => {
    const a = wrapEnvelope("structured-context", "1", { foo: 1 }, { taskId: "t1" });
    const b = wrapEnvelope("structured-context", "1", { foo: 1 }, { taskId: "t1" });
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(a.type).toBe("structured-context");
    expect(a.version).toBe("1");
    expect(a.data).toEqual({ foo: 1 });
    expect(a.parentId).toBeNull();
  });

  it("threads parentId through a chain", () => {
    const a = wrapEnvelope("structured-context", "1", {}, { taskId: "t1" }, null);
    const b = wrapEnvelope("draft-questions", "1", {}, { taskId: "t1" }, a.id);
    const c = wrapEnvelope("canonical-json", "1", {}, { taskId: "t1" }, b.id);
    expect(b.parentId).toBe(a.id);
    expect(c.parentId).toBe(b.id);
    const lineage = chainLineage(a, b, c);
    expect(lineage).toHaveLength(3);
    expect(lineage[1].parentId).toBe(lineage[0].id);
    expect(lineage[2].parentId).toBe(lineage[1].id);
  });

  it("assertEnvelope validates shape", () => {
    expect(assertEnvelope(wrapEnvelope("draft-questions", "1", [], {})).ok).toBe(true);
    expect(assertEnvelope(null).ok).toBe(false);
    expect(assertEnvelope({ id: "", type: "x", version: "1", data: {}, metadata: {} }).ok).toBe(false);
    expect(assertEnvelope({ id: "x", type: "x", version: "1", data: {}, metadata: null }).ok).toBe(false);
  });

  it("metadata has all required fields", () => {
    const e = wrapEnvelope("canonical-json", "1", {}, { taskId: "t1", provider: "google", model: "gemini", promptVersion: "v1", schemaVersion: "1" });
    for (const key of ["taskId", "provider", "model", "promptVersion", "schemaVersion", "createdAt"]) {
      expect(e.metadata).toHaveProperty(key);
    }
    expect(e.metadata.taskId).toBe("t1");
  });
});