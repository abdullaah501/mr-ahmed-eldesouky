import { describe, it, expect, vi } from "vitest";
import { assertDraftQuestions } from "../../lib/ai/workflows/questionGeneration/schema/draftQuestions";
import "../../lib/ai/prompts";
import { renderPrompt } from "../../lib/ai/prompts/PromptManager";

// Runtime grade source is the Grade collection â€” unit suites mock it.
vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { name: "دورات أخرى" },
          { name: "الصف الأول الثانوي" },
          { name: "الصف الثاني الثانوي" },
          { name: "الصف الثالث الثانوي" },
        ]),
      }),
    }),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue({}),
}));

const ctx = () => ({ context: { subject: "الرياضيات", grade: "الصف الأول الثانوي" }, params: {}, answers: {} });

describe("Wave 3 — MCQ correctAnswer schema hard floor", () => {
  it("accepts an MCQ whose correctAnswer matches an option valueText", async () => {
    const drafts = [{
      type: "multiple-choice",
      questionText: "ما ناتج 2+2؟",
      correctAnswer: "b",
      options: [
        { optionText: "3", valueText: "a" },
        { optionText: "4", valueText: "b" },
        { optionText: "5", valueText: "c" },
        { optionText: "6", valueText: "d" },
      ],
    }];
    expect(assertDraftQuestions(drafts).ok).toBe(true);
  });

  it("rejects MCQ when correctAnswer is the optionText instead of valueText", async () => {
    const drafts = [{
      type: "multiple-choice",
      questionText: "ما ناتج 2+2؟",
      correctAnswer: "4",
      options: [
        { optionText: "3", valueText: "a" },
        { optionText: "4", valueText: "b" },
        { optionText: "5", valueText: "c" },
        { optionText: "6", valueText: "d" },
      ],
    }];
    const result = assertDraftQuestions(drafts);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/correctAnswer must match/);
  });

  it("rejects MCQ when options[] has no matching valueText for correctAnswer", async () => {
    const drafts = [{
      type: "multiple-choice",
      questionText: "س؟",
      correctAnswer: "z",
      options: [
        { optionText: "1", valueText: "a" },
        { optionText: "2", valueText: "b" },
      ],
    }];
    const result = assertDraftQuestions(drafts);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/valueText/);
  });

  it("accepts MCQ when correctAnswer is omitted (existing min-2 still allowed)", async () => {
    const drafts = [{
      type: "multiple-choice",
      questionText: "س؟",
      correctAnswer: "",
      options: [
        { optionText: "1", valueText: "a" },
        { optionText: "2", valueText: "b" },
      ],
    }];
    const result = assertDraftQuestions(drafts);
    expect(result.errors.join(" ")).not.toMatch(/valueText/);
  });
});

describe("Wave 3 — inspectStage enum mismatch (subject / grade)", () => {
  it("flag non-canonical context.subject (close-alias) for teacher re-confirmation", async () => {
    const inspect = (await import("../../lib/ai/workflows/missingInfoCollection/stages/inspectStage")).default;
    const ctxInstance = {
      inputs: {
        context: { subject: "رياضيات", grade: "الصف الأول الثانوي" },
        answers: {},
        generationParams: {},
      },
      outputs: {},
    };
    await inspect.run(ctxInstance);
    const missing = ctxInstance.outputs.missingFields.map((f) => f.key);
    expect(missing).toContain("subject");
  });

  it("do not flag canonical context.subject", async () => {
    const inspect = (await import("../../lib/ai/workflows/missingInfoCollection/stages/inspectStage")).default;
    const ctxInstance = {
      inputs: {
        context: { subject: "الرياضيات", grade: "الصف الأول الثانوي" },
        answers: {},
        generationParams: { difficulty: "medium", questionCount: 1, questionTypes: ["essay"] },
      },
      outputs: {},
    };
    await inspect.run(ctxInstance);
    const missing = ctxInstance.outputs.missingFields.map((f) => f.key);
    expect(missing).not.toContain("subject");
  });

  it("flag non-canonical context.subject when wrapped in {value,confidence} object", async () => {
    const inspect = (await import("../../lib/ai/workflows/missingInfoCollection/stages/inspectStage")).default;
    const ctxInstance = {
      inputs: {
        context: {
          subject: { value: "رياضيات", confidence: 0.9, sourceRanges: [] },
          grade: { value: "الصف الأول الثانوي", confidence: 0.9 },
        },
        answers: {},
        generationParams: { difficulty: "medium", questionCount: 1, questionTypes: ["essay"] },
      },
      outputs: {},
    };
    await inspect.run(ctxInstance);
    const missing = ctxInstance.outputs.missingFields.map((f) => f.key);
    expect(missing).toContain("subject");
  });
});

describe("Wave 3 — v2 prompt clarifications", () => {
  it("MCQ contract includes a concrete example with valueText letters", async () => {
    const { system } = (await renderPrompt("question-generation", { questionCount: 1 }, { version: "v2" })).text;
    expect(system).toMatch(/valueText is one of "a", "b", "c", or "d"/);
    expect(system).toContain('correctAnswer "b"');
  });

  it("fill-blank contract requires one correct candidate and plausible distractors", async () => {
    const { system } = (await renderPrompt("question-generation", { questionCount: 1 }, { version: "v2" })).text;
    expect(system).toContain("Exactly one candidate has isCorrect true");
    expect(system).toContain("every other candidate has isCorrect false");
    expect(system).toContain("plausible");
    expect(system).toContain("do NOT use config.answers");
  });

  it("matching contract enforces a minimum of 4 pairs", async () => {
    const { system } = (await renderPrompt("question-generation", { questionCount: 1 }, { version: "v2" })).text;
    expect(system).toContain("minimum of 4");
    expect(system).not.toMatch(/at least 2 non-empty pairs/);
  });
});
