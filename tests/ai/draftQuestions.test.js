import { describe, it, expect } from "vitest";
import { assertDraftQuestions } from "../../lib/ai/workflows/questionGeneration/schema/draftQuestions";

const validMCQ = {
  type: "multiple-choice",
  questionText: "ما هو 2+2؟",
  correctAnswer: "b",
  options: [{ optionText: "3", valueText: "a" }, { optionText: "4", valueText: "b" }],
  _gen: { confidence: 0.9 },
};

describe("assertDraftQuestions", () => {
  it("accepts a valid MCQ", () => {
    expect(assertDraftQuestions([validMCQ]).ok).toBe(true);
  });

  it("rejects non-array", () => {
    expect(assertDraftQuestions({}).ok).toBe(false);
    expect(assertDraftQuestions(null).ok).toBe(false);
  });

  it("rejects image-choice (excluded)", () => {
    const r = assertDraftQuestions([{ type: "image-choice", questionText: "x", correctAnswer: "a" }]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("feasible");
  });

  it("rejects empty questionText", () => {
    const r = assertDraftQuestions([{ type: "essay", questionText: "" }]);
    expect(r.ok).toBe(false);
  });

  it("validates MCQ needs ≥2 options + correctAnswer", () => {
    expect(assertDraftQuestions([{ type: "multiple-choice", questionText: "q", correctAnswer: "a", options: [{ optionText: "x", valueText: "a" }] }]).ok).toBe(false);
    expect(assertDraftQuestions([{ type: "multiple-choice", questionText: "q", correctAnswer: "", options: [{ optionText: "x", valueText: "a" }, { optionText: "y", valueText: "b" }] }]).ok).toBe(false);
  });

  it("validates fill-blank needs ____ + 3 options + exactly 1 isCorrect", () => {
    const validOptions = [
      { id: "1", text: "x", isCorrect: true },
      { id: "2", text: "y", isCorrect: false },
      { id: "3", text: "z", isCorrect: false },
    ];
    expect(assertDraftQuestions([{ type: "fill-blank", questionText: "no blank", correctAnswer: "x", options: validOptions }]).ok).toBe(false);
    expect(assertDraftQuestions([{ type: "fill-blank", questionText: "____", correctAnswer: "x", options: validOptions.map((option) => ({ ...option, isCorrect: true })) }]).ok).toBe(false);
    expect(assertDraftQuestions([{ type: "fill-blank", questionText: "____", correctAnswer: "x", options: validOptions }]).ok).toBe(true);
    expect(assertDraftQuestions([{ type: "fill-blank", questionText: "____", correctAnswer: "x", config: { answers: validOptions } }]).ok).toBe(false);
  });

  it("validates matching needs ≥2 pairs", () => {
    expect(assertDraftQuestions([{ type: "matching", questionText: "match", correctAnswer: "", config: { pairs: [{ id: "1", leftItem: "a", rightItem: "b" }] } }]).ok).toBe(false);
    expect(assertDraftQuestions([{ type: "matching", questionText: "match", correctAnswer: "", config: { pairs: [{ id: "1", leftItem: "a", rightItem: "b" }, { id: "2", leftItem: "c", rightItem: "d" }] } }]).ok).toBe(true);
  });

  it("essay requires a non-empty model answer (AI-generation contract)", () => {
    // AI-generated essay drafts are incomplete without their model answer.
    expect(assertDraftQuestions([{ type: "essay", questionText: "نص" }]).ok).toBe(false);
    expect(
      assertDraftQuestions([{ type: "essay", questionText: "نص", correctAnswer: "   " }]).ok
    ).toBe(false);
    expect(
      assertDraftQuestions([
        { type: "essay", questionText: "نص", correctAnswer: "نموذج الإجابة" },
      ]).ok
    ).toBe(true);
  });
});
