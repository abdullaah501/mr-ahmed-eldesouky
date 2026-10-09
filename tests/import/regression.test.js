import { describe, it, expect } from "vitest";
import { normalize } from "../../src/question-system/plugins/registry";

import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/essay/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";

describe("Regression tests", () => {
  describe("Matching normalize preserves imported correctAnswer", () => {
    it("keeps imported correctAnswer when present", () => {
      const input = {
        type: "matching",
        questionText: "Match",
        correctAnswer: "imported-answer",
        config: { pairs: [{ leftItem: "A", rightItem: "1" }] },
      };
      const result = normalize("matching", input);
      expect(result.correctAnswer).toBe("imported-answer");
    });

    it("generates correctAnswer when missing", () => {
      const input = {
        type: "matching",
        questionText: "Match",
        correctAnswer: "",
        config: { pairs: [{ leftItem: "A", rightItem: "1" }] },
      };
      const result = normalize("matching", input);
      expect(result.correctAnswer).toBe(JSON.stringify([["A", "1"]]));
    });
  });

  describe("Image-choice validation accepts buffer OR cloudId", () => {
    it("accepts image with cloudId", () => {
      const input = {
        type: "image-choice",
        questionText: "Which one?",
        correctAnswer: "a",
        options: [
          { optionText: "", valueText: "a", image: { cloudId: "abc123", url: "https://..." } },
          { optionText: "", valueText: "b", image: { cloudId: "def456", url: "https://..." } },
        ],
      };
      const normalized = normalize("image-choice", input);
      expect(normalized.options[0].image.cloudId).toBe("abc123");
    });

    it("preserves image buffer in mapped output", () => {
      const input = {
        type: "image-choice",
        questionText: "Which one?",
        correctAnswer: "a",
        options: [
          { optionText: "", valueText: "a", image: { buffer: Buffer.from([1, 2, 3]) } },
          { optionText: "", valueText: "b", image: { buffer: Buffer.from([4, 5, 6]) } },
        ],
      };
      const normalized = normalize("image-choice", input);
      expect(normalized.options[0].image.buffer).toBeDefined();
      expect(normalized.options[0].image.cloudId).toBeUndefined();
    });
  });

  describe("JSON import still works", () => {
    it("JSON plugin parse returns canonical shape", async () => {
      const { parseJsonBuffer } = await import("../../lib/import/plugins/json/parser");
      const result = parseJsonBuffer(Buffer.from(JSON.stringify([
        {
          type: "multiple-choice",
          questionText: "Test",
          options: [{ optionText: "A", valueText: "a" }],
          correctAnswer: "a",
          difficulty: "easy",
          grade: "10",
        },
      ])));
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].type).toBe("multiple-choice");
      expect(result.questions[0].correctAnswer).toBe("a");
      expect(result.questions[0].difficulty).toBe("easy");
    });
  });
});
