import { describe, it, expect } from "vitest";
import { normalizeLabel, ordinalToIndex } from "../../lib/import/shared/labelNormalizer";

describe("labelNormalizer", () => {
  describe("normalizeLabel", () => {
    it("maps English lowercase to index", () => {
      expect(normalizeLabel("a")).toBe(1);
      expect(normalizeLabel("b")).toBe(2);
      expect(normalizeLabel("c")).toBe(3);
      expect(normalizeLabel("d")).toBe(4);
    });

    it("maps English uppercase to index", () => {
      expect(normalizeLabel("A")).toBe(1);
      expect(normalizeLabel("B")).toBe(2);
      expect(normalizeLabel("C")).toBe(3);
      expect(normalizeLabel("D")).toBe(4);
    });

    it("maps Arabic letters to index", () => {
      expect(normalizeLabel("أ")).toBe(1);
      expect(normalizeLabel("ب")).toBe(2);
      expect(normalizeLabel("ج")).toBe(3);
      expect(normalizeLabel("د")).toBe(4);
    });

    it("maps numeric strings to index", () => {
      expect(normalizeLabel("1")).toBe(1);
      expect(normalizeLabel("2")).toBe(2);
      expect(normalizeLabel("3")).toBe(3);
      expect(normalizeLabel("4")).toBe(4);
    });

    it("handles whitespace", () => {
      expect(normalizeLabel("  B  ")).toBe(2);
      expect(normalizeLabel("  ب  ")).toBe(2);
    });

    it("returns null for unknown labels", () => {
      expect(normalizeLabel("z")).toBeNull();
      expect(normalizeLabel("")).toBeNull();
      expect(normalizeLabel(null)).toBeNull();
    });
  });

  describe("ordinalToIndex", () => {
    it("converts ordinal to zero-based index", () => {
      expect(ordinalToIndex(1, 4)).toBe(0);
      expect(ordinalToIndex(2, 4)).toBe(1);
      expect(ordinalToIndex(4, 4)).toBe(3);
    });

    it("returns -1 for out-of-range ordinals", () => {
      expect(ordinalToIndex(0, 4)).toBe(-1);
      expect(ordinalToIndex(5, 4)).toBe(-1);
    });

    it("handles empty options", () => {
      expect(ordinalToIndex(1, 0)).toBe(-1);
    });
  });
});
