import { describe, it, expect } from "vitest";
import { detectCorrectAnswer } from "../../lib/import/shared/answerDetector";

describe("answerDetector", () => {
  describe("MCQ", () => {
    const opts = [
      { optionText: "Option A", valueText: "a" },
      { optionText: "Option B", valueText: "b" },
      { optionText: "Option C", valueText: "c" },
      { optionText: "Option D", valueText: "d" },
    ];

    it("detects English answer label", () => {
      const result = detectCorrectAnswer({
        text: "What is 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B",
        type: "multiple-choice",
        options: opts,
      });
      expect(result.correctAnswer).toBe("b");
    });

    it("detects Arabic answer label", () => {
      const result = detectCorrectAnswer({
        text: "ما هو 2+2؟\nأ) 3\nب) 4\nج) 5\nد) 6\nالإجابة الصحيحة: ب",
        type: "multiple-choice",
        options: opts,
      });
      expect(result.correctAnswer).toBe("b");
    });

    it("detects numeric answer", () => {
      const result = detectCorrectAnswer({
        text: "Question\n1) A\n2) B\n3) C\nAnswer: 2",
        type: "multiple-choice",
        options: [{ optionText: "A", valueText: "1" }, { optionText: "B", valueText: "2" }, { optionText: "C", valueText: "3" }],
      });
      expect(result.correctAnswer).toBe("2");
    });

    it("strips answer line from text", () => {
      const result = detectCorrectAnswer({
        text: "What is 2+2?\nAnswer: B",
        type: "multiple-choice",
        options: opts,
      });
      expect(result.cleanedText).toBe("What is 2+2?");
    });
  });

  describe("True/False", () => {
    it("detects Arabic صح", () => {
      const result = detectCorrectAnswer({
        text: "الشمس نجم.\nالإجابة: صح",
        type: "true-false",
        options: [],
      });
      expect(result.correctAnswer).toBe("صح");
    });

    it("detects English true", () => {
      const result = detectCorrectAnswer({
        text: "The sun is a star.\nAnswer: true",
        type: "true-false",
        options: [],
      });
      expect(result.correctAnswer).toBe("صح");
    });

    it("detects خطأ", () => {
      const result = detectCorrectAnswer({
        text: "The moon is a star.\nالإجابة: خطأ",
        type: "true-false",
        options: [],
      });
      expect(result.correctAnswer).toBe("خطأ");
    });
  });

  describe("Essay", () => {
    it("detects model answer", () => {
      const result = detectCorrectAnswer({
        text: "Explain photosynthesis.\nالإجابة النموذجية: Photosynthesis is the process...",
        type: "essay",
        options: [],
      });
      expect(result.correctAnswer).toBe("Photosynthesis is the process...");
    });
  });

  describe("Fill-blank", () => {
    it("parses [x] marker as correct answer", () => {
      const result = detectCorrectAnswer({
        text: "عاصمة مصر هي ____.\n[x] القاهرة\n[ ] Cairo\n[ ] مدينة القاهرة",
        type: "fill-blank",
        options: [],
      });
      expect(result.correctAnswer).toBe("القاهرة");
      expect(result.options).toHaveLength(3);
      expect(result.options[0]).toEqual({ text: "القاهرة", isCorrect: true });
      expect(result.options[1]).toEqual({ text: "Cairo", isCorrect: false });
      expect(result.cleanedText).toBe("عاصمة مصر هي ____.");
    });

    it("parses [✓] Unicode checkmark as correct", () => {
      const result = detectCorrectAnswer({
        text: "What is ____?\n[✓] water\n[ ] fire",
        type: "fill-blank",
        options: [],
      });
      expect(result.correctAnswer).toBe("water");
      expect(result.options[0].isCorrect).toBe(true);
      expect(result.options[1].isCorrect).toBe(false);
    });

    it("only marks first [x] as correct when multiple are marked", () => {
      const result = detectCorrectAnswer({
        text: "Fill ____.\n[x] one\n[x] two\n[ ] three",
        type: "fill-blank",
        options: [],
      });
      expect(result.correctAnswer).toBe("one");
      expect(result.options[0].isCorrect).toBe(true);
      expect(result.options[1].isCorrect).toBe(false);
      expect(result.options[2].isCorrect).toBe(false);
    });

    it("returns empty when no checkbox markers found", () => {
      const result = detectCorrectAnswer({
        text: "Plain text without any markers",
        type: "fill-blank",
        options: [],
      });
      expect(result.correctAnswer).toBe("");
      expect(result.options).toBeUndefined();
    });

    it("legacy format still imports: الإجابة + bullets", () => {
      const result = detectCorrectAnswer({
        text: "عاصمة مصر هي ____.\nالإجابة الصحيحة:\n- القاهرة\n- Cairo",
        type: "fill-blank",
        options: [],
      });
      expect(result.correctAnswer).toBe("Cairo");
      expect(result.options).toHaveLength(1);
      expect(result.options[0].isCorrect).toBe(true);
    });

    it("legacy format still imports: single answer on same line", () => {
      const result = detectCorrectAnswer({
        text: "The capital of France is ____.\nالإجابة: Paris",
        type: "fill-blank",
        options: [],
      });
      expect(result.correctAnswer).toBe("Paris");
    });
  });

  describe("Matching", () => {
    it("detects pairs from -> syntax", () => {
      const result = detectCorrectAnswer({
        text: "Paris -> France\nBerlin -> Germany\nMadrid -> Spain",
        type: "matching",
        options: [],
      });
      expect(result.config).toBeDefined();
      expect(result.config.pairs).toHaveLength(3);
      expect(result.config.pairs[0]).toEqual({ leftItem: "Paris", rightItem: "France" });
      expect(result.correctAnswer).toBe('[["Paris","France"],["Berlin","Germany"],["Madrid","Spain"]]');
    });

    it("returns empty for plain text without pairs", () => {
      const result = detectCorrectAnswer({
        text: "Match the items.",
        type: "matching",
        options: [],
      });
      expect(result.correctAnswer).toBe("");
    });
  });
});
