import { describe, it, expect, vi } from "vitest";
import { mapDraftQuestionToCanonical, buildCanonicalJson } from "../../lib/ai/workflows/canonicalJsonBuild/fieldMapping";
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

const ctx = {
  provenance: { aiProvider: "google", aiModel: "gemini-2.5-flash", aiPromptId: "question-generation", aiPromptVersion: "v1" },
  params: { grade: "g1", subject: "math", difficulty: "medium", tags: ["algebra"] },
  context: {},
  defaults: {},
  feature: "repository",
};

const draftMCQ = {
  type: "multiple-choice",
  questionText: "ما هو 2+2؟",
  correctAnswer: "b",
  options: [{ optionText: "3", valueText: "a" }, { optionText: "4", valueText: "b" }],
  difficulty: "easy",
  grade: "g1",
  subject: "math",
  tags: ["basics"],
  _gen: { bloomLevel: "remember", confidence: 0.92 },
};

describe("fieldMapping", () => {
  it("maps a DraftQuestion to canonical shape", async () => {
    const canon = await mapDraftQuestionToCanonical(draftMCQ, ctx);
    expect(canon.type).toBe("multiple-choice");
    expect(canon.questionText).toBe("ما هو 2+2؟");
    expect(canon.options).toHaveLength(2);
    expect(canon.image).toEqual({});
    expect(canon.aiProvider).toBe("google");
    expect(canon.aiModel).toBe("gemini-2.5-flash");
    expect(canon.aiPromptId).toBe("question-generation");
    expect(canon.aiPromptVersion).toBe("v1");
    expect(canon).not.toHaveProperty("_gen");
    expect(canon).not.toHaveProperty("source");
    expect(canon).not.toHaveProperty("status");
  });

  it("buildCanonicalJson assembles { questions, defaults, _meta }", async () => {
    const json = await buildCanonicalJson([draftMCQ], ctx);
    expect(json.questions).toHaveLength(1);
    expect(json.defaults).toBeDefined();
    expect(json.defaults.grade).toBe("g1");
    expect(json._meta).toBeDefined();
    expect(json._meta.generator).toBeDefined();
    expect(json._meta.generator.provider).toBe("google");
    expect(json._meta.generator.model).toBe("gemini-2.5-flash");
    expect(json._meta.generator.promptVersion).toBe("v1");
    expect(json._meta.feature).toBe("repository");
  });

  it("per-question provenance is FLAT (not nested in _meta.generator)", async () => {
    const json = await buildCanonicalJson([draftMCQ], ctx);
    const q = json.questions[0];
    expect(q.aiProvider).toBe("google");
    expect(q.aiModel).toBe("gemini-2.5-flash");
    expect(q.aiPromptId).toBe("question-generation");
    expect(q.aiPromptVersion).toBe("v1");
    expect(q).not.toHaveProperty("generator");
  });

  it("strips _gen from all questions", async () => {
    const json = await buildCanonicalJson([draftMCQ, { type: "essay", questionText: "x", _gen: { confidence: 0.5 } }], ctx);
    for (const q of json.questions) {
      expect(q).not.toHaveProperty("_gen");
    }
  });

  it("does not stamp source/importSource/status (pipeline does)", async () => {
    const q = await mapDraftQuestionToCanonical(draftMCQ, ctx);
    expect(q).not.toHaveProperty("source");
    expect(q).not.toHaveProperty("importSource");
    expect(q).not.toHaveProperty("status");
  });

  it("image is always {} for text generation", async () => {
    const q = await mapDraftQuestionToCanonical({ ...draftMCQ, image: null }, ctx);
    expect(q.image).toEqual({});
  });
});