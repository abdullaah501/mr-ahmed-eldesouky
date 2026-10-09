import { describe, it, expect } from "vitest";
import { assertStructuredContext, collectLowConfidence, SCHEMA_ID, SCHEMA_VERSION } from "../../lib/ai/workflows/knowledgeExtraction/schema/structuredContext";
import "../../lib/ai/schemas";

describe("assertStructuredContext", () => {
  it("accepts minimal object with subject", () => {
    const r = assertStructuredContext({ subject: "math" });
    expect(r.ok).toBe(true);
  });

  it("accepts object with topics list", () => {
    const r = assertStructuredContext({ topics: ["x"] });
    expect(r.ok).toBe(true);
  });

  it("rejects non-object", () => {
    expect(assertStructuredContext("x").ok).toBe(false);
    expect(assertStructuredContext(null).ok).toBe(false);
  });

  it("rejects empty object (no subject/topics/lessonTitle)", () => {
    expect(assertStructuredContext({}).ok).toBe(false);
  });

  it("rejects array where a list field should be", () => {
    const r = assertStructuredContext({ subject: "m", topics: "nope" });
    expect(r.ok).toBe(false);
  });
});

describe("collectLowConfidence", () => {
  it("collects fields below 0.5", () => {
    const ctx = {
      subject: { value: "math", confidence: 0.2 },
      topics: [{ value: "a", confidence: 0.9 }, { value: "b", confidence: 0.3 }],
      _meta: {},
    };
    const low = collectLowConfidence(ctx);
    expect(low).toContain("subject");
    expect(low).toContain("topics[1]");
  });

  it("ignores scalar strings (no confidence attr)", () => {
    const ctx = { subject: "math", topics: ["a"], _meta: {} };
    const low = collectLowConfidence(ctx);
    expect(low).toEqual([]);
  });
});

describe("schema registration", () => {
  it("StructuredContext schema is registered", async () => {
    const { getSchema } = await import("../../lib/ai/schemas");
    expect(getSchema(SCHEMA_ID, SCHEMA_VERSION)).toBeTruthy();
  });
});