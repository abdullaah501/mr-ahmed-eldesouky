import { describe, it, expect } from "vitest";
import { isAbortError, structuredContextErrorMessage } from "../../src/hooks/useAiWorkflow";

describe("isAbortError", () => {
  it("returns true when signal is aborted", () => {
    const ac = new AbortController();
    ac.abort();
    expect(isAbortError(new Error("x"), ac.signal)).toBe(true);
  });

  it("returns true when error name is AbortError", () => {
    expect(isAbortError({ name: "AbortError", message: "x" })).toBe(true);
  });

  it("returns false for normal errors", () => {
    expect(isAbortError({ name: "TypeError", message: "x" })).toBe(false);
    expect(isAbortError(new Error("fetch failed"))).toBe(false);
  });
});

describe("structuredContextErrorMessage", () => {
  it("renders an Arabic structural-error message", () => {
    const out = structuredContextErrorMessage({
      subject: "الرياضيات",
      lessonTitle: "المعادلات",
      topics: ["x", "y", "z"],
    });
    expect(out).toContain("Could not parse the content extracted");
  });

  it("does not expose structured context internals", () => {
    const out = structuredContextErrorMessage({});
    expect(out).not.toContain("StructuredContext");
  });

  it("uses the same Arabic structural message for wrapped values", () => {
    const out = structuredContextErrorMessage({ subject: { value: "الأحياء" }, lessonTitle: { value: "الخلية" } });
    expect(out).toContain("Could not parse the content extracted");
  });
});
