import { describe, it, expect, beforeEach } from "vitest";
import { getRunStore, resetRunStoreCache, NullRunStore } from "../../lib/ai/core/runStore";
import { reloadAiEnv } from "../../lib/ai/config/env";

beforeEach(() => {
  delete process.env.AI_DEBUG;
  resetRunStoreCache();
  reloadAiEnv();
});

describe("runStore", () => {
  it("returns NullRunStore by default", () => {
    const store = getRunStore();
    expect(store.recordRun({})).toBe(null);
  });

  it("NullRunStore discards everything", () => {
    expect(NullRunStore.recordRun({ prompt: "secret" })).toBe(null);
  });

  it("returns a debug ring when AI_DEBUG=true", async () => {
    process.env.AI_DEBUG = "true";
    reloadAiEnv();
    resetRunStoreCache();
    const store = getRunStore();
    store.recordRun({ foo: 1 });
    store.recordRun({ bar: 2 });
    const snap = store.snapshot();
    expect(snap).toHaveLength(2);
    store.recordRun({ baz: 3 });
    expect(store.snapshot()).toContainEqual(expect.objectContaining({ baz: 3 }));
  });

  it("never persists prompts/outputs in the run record by default", () => {
    const store = getRunStore();
    const record = { prompt: "secret", output: "secret-output" };
    const result = store.recordRun(record);
    expect(result).toBe(null);
  });
});