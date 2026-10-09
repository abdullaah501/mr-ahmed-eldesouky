import { describe, it, expect } from "vitest";
import { normalizeText, collapseBlankLines, truncate } from "../../lib/ai/resources/textNormalization";

describe("textNormalization", () => {
  it("normalizes NFC equivalent strings", () => {
    const composed = "\u0627"; // alef
    const decomposed = "\u0627";
    expect(normalizeText(decomposed)).toBe(composed);
  });

  it("strips zero-width chars", () => {
    const text = "abc\u200B\u200Cde\uFEFFfg";
    expect(normalizeText(text)).toBe("abcdefg".replace(/[\u200B\uFEFF]/g, ""));
  });

  it("strips RTL/LTR marks", () => {
    const text = "hello\u200Eworld\u202B";
    expect(normalizeText(text)).not.toContain("\u200E");
    expect(normalizeText(text)).not.toContain("\u202B");
  });

  it("strips Arabic tatweel", () => {
    expect(normalizeText("ا\u0640لله")).toBe("الله");
  });

  it("strips control characters", () => {
    const text = "a\u0007b\u001Fc";
    const out = normalizeText(text);
    expect(out).not.toContain("\u0007");
    expect(out).not.toContain("\u001F");
  });

  it("collapses blank lines", () => {
    const text = "a\n\n\n\n\nb";
    expect(collapseBlankLines(text)).toBe("a\n\nb");
  });

  it("trims whitespace", () => {
    expect(normalizeText("   hello   ")).toBe("hello");
  });

  it("truncate cuts to maxChars", () => {
    expect(truncate("abcdefghij", 4)).toBe("abcd");
    expect(truncate("abc", 100)).toBe("abc");
  });

  it("handles null/undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});