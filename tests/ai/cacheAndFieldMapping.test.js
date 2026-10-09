import { describe, it, expect, vi } from "vitest";
import { deterministicCacheKey } from "../../lib/ai/cache/cacheKey";
import { mapDraftQuestionToCanonical } from "../../lib/ai/workflows/canonicalJsonBuild/fieldMapping";

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

describe("deterministicCacheKey", () => {
  const base = { normalizedInput: "ctx", promptId: "knowledge-extraction", promptVersion: "v1", schemaId: "structured-context", schemaVersion: "1", providerId: "google", modelId: "gemini-3.1-flash-lite", capabilityProfile: { vision: true } };

  it("is stable for identical inputs", async () => {
    expect(deterministicCacheKey(base)).toBe(deterministicCacheKey({ ...base }));
  });

  it("changes when generation params differ (extra)", async () => {
    const a = deterministicCacheKey({ ...base, extra: { questionCount: 5 } });
    const b = deterministicCacheKey({ ...base, extra: { questionCount: 7 } });
    expect(a).not.toBe(b);
  });

  it("changes when focusTopic differs (extra)", async () => {
    const a = deterministicCacheKey({ ...base, extra: { focusTopic: "equations" } });
    const b = deterministicCacheKey({ ...base, extra: { focusTopic: "geometry" } });
    expect(a).not.toBe(b);
  });

  it("treats absent extra same as empty object", async () => {
    expect(deterministicCacheKey(base)).toBe(deterministicCacheKey({ ...base, extra: {} }));
  });
});

describe("mapDraftQuestionToCanonical", () => {
  const ctx = { context: { grade: "الصف الأول الثانوي", subject: "الرياضيات" }, params: { difficulty: "medium" } };

  it("uses teacher's canonical grade when AI draft grade is non-canonical", async () => {
    const draft = { type: "multiple-choice", questionText: "س", options: [], correctAnswer: "a", grade: "الأول الثانوي" };
    const out = await mapDraftQuestionToCanonical(draft, ctx);
    expect(out.grade).toBe("الصف الأول الثانوي");
    expect(out.subject).toBe("الرياضيات");
    expect(out.difficulty).toBe("medium");
  });

  it("normalizes difficulty Arabic labels", async () => {
    const draft = { type: "essay", questionText: "س", correctAnswer: "", difficulty: "متوسط" };
    const out = await mapDraftQuestionToCanonical(draft, ctx);
    expect(out.difficulty).toBe("medium");
  });

  it("defaults difficulty to medium when nothing provided", async () => {
    const draft = { type: "essay", questionText: "س", correctAnswer: "" };
    const out = await mapDraftQuestionToCanonical(draft, ctx);
    expect(out.difficulty).toBe("medium");
  });
});
