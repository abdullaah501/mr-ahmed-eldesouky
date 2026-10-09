import { describe, it, expect, beforeEach, vi } from "vitest";

// Runtime grade source is the Grade collection â€” unit suites mock it.
vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue([
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

vi.mock("../../lib/ai/cache/generationCache", async (importOriginal) => {
  const orig = await importOriginal();
  let mem = new Map();
  return {
    ...orig,
    buildGenerationKey: orig.buildGenerationKey,
    getGeneration: vi.fn(async (key) => (mem.has(key) ? mem.get(key) : null)),
    setGeneration: vi.fn(async (key, value) => {
      mem.set(key, value);
      return true;
    }),
    resetGenerationCacheAdapter: () => {
      mem = new Map();
    },
  };
});

vi.mock("../../lib/ai/outputTargets", () => ({
  resolveOutputTarget: vi.fn(),
}));

import { ai } from "../../lib/ai/index.js";
import {
  clearProviders,
  registerProvider,
} from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { resetGenerationCacheAdapter } from "../../lib/ai/cache/generationCache";
import { resolveOutputTarget } from "../../lib/ai/outputTargets";
import { makeFakeProvider } from "./helpers/fakeProvider";
import { makeMockOutputTarget } from "./helpers/mockImportEngine";

const structuredContext = {
  subject: "الرياضيات",
  grade: "الصف الأول الثانوي",
  language: "en",
  topics: [{ value: "equations", confidence: 0.9 }],
  _meta: { overallConfidence: 0.85, lowConfidence: [] },
};

const draftQuestions = [
  {
    type: "multiple-choice",
    questionText: "ما هو 2+2؟",
    correctAnswer: "b",
    options: [
      { optionText: "3", valueText: "a" },
      { optionText: "4", valueText: "b" },
    ],
    difficulty: "easy",
    _gen: { confidence: 0.9 },
  },
];

beforeEach(() => {
  clearProviders();
  resetAll();
  resetGenerationCacheAdapter();
  resolveOutputTarget.mockReturnValue(
    makeMockOutputTarget({ id: "repository" }),
  );
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
});

describe("full flow — Stage 2→5 chain (envelope lineage + mock output)", () => {
  it("chains all 4 C2 workflows with parentId lineage", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: draftQuestions }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const stage1Artifact = structuredContext;
    const stage1Id = "art_stage1";

    const stage2 = await ai({
      type: "missing-info-collection",
      feature: "repository",
      context: structuredContext,
      answers: {
        difficulty: "easy",
        questionCount: 1,
        questionTypes: ["multiple-choice"],
      },
      parentArtifactId: stage1Id,
    });
    expect(stage2.status).toBe("complete");
    expect(stage2.artifact.parentId).toBe(stage1Id);

    const stage2Artifact = stage2.artifact;

    const stage3 = await ai({
      type: "question-generation",
      feature: "repository",
      context: stage2.context,
      generationParams: stage2.generationParams,
      parentArtifactId: stage2Artifact.id,
    });
    expect(stage3.status).toBe("ok");
    expect(stage3.artifact.parentId).toBe(stage2Artifact.id);
    expect(stage3.artifact.type).toBe("draft-questions");

    const stage3Artifact = stage3.artifact;

    const stage4 = await ai({
      type: "canonical-json-build",
      feature: "repository",
      context: stage2.context,
      generationParams: stage2.generationParams,
      draftArtifact: stage3Artifact,
      userId: "u1",
    });
    expect(stage4.status).toBe("ok");
    expect(stage4.artifact.parentId).toBe(stage3Artifact.id);
    expect(stage4.artifact.type).toBe("canonical-json");

    const stage4Artifact = stage4.artifact;

    const stage5 = await ai({
      type: "repository-import",
      feature: "repository",
      canonicalArtifact: stage4Artifact,
      userId: "u1",
      requestId: "r1",
    });
    expect(stage5.status).toBe("ok");
    expect(stage5.importResult.ok).toBe(true);

    const target = resolveOutputTarget();
    expect(target._calls[0].artifact.type).toBe("canonical-json");
    expect(target._calls[0].metadata.userId).toBe("u1");
  });

  it("image-choice never appears in generated questions", async () => {
    const badQuestions = [
      { type: "image-choice", questionText: "x", correctAnswer: "a" },
    ];
    registerProvider(makeFakeProvider({ id: "fake", object: badQuestions }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "question-generation",
      feature: "repository",
      context: structuredContext,
      generationParams: {
        difficulty: "easy",
        questionCount: 1,
        questionTypes: ["multiple-choice"],
      },
    });
    expect(result.status).toBe("failed");
    expect(result.errors.some((e) => e.message.includes("feasible"))).toBe(
      true,
    );
  });
});
