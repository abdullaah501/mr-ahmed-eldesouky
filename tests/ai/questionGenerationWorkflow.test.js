import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/ai/cache/generationCache", async (importOriginal) => {
  const orig = await importOriginal();
  let mem = new Map();
  return {
    ...orig,
    buildGenerationKey: orig.buildGenerationKey,
    getGeneration: vi.fn(async (key) => (mem.has(key) ? mem.get(key) : null)),
    setGeneration: vi.fn(async (key, value) => { mem.set(key, value); return true; }),
    resetGenerationCacheAdapter: () => { mem = new Map(); },
  };
});

import { ai } from "../../lib/ai/index.js";
import { clearProviders, registerProvider } from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { resetGenerationCacheAdapter } from "../../lib/ai/cache/generationCache";
import { makeFakeProvider } from "./helpers/fakeProvider";

const draftQuestions = [
  {
    type: "multiple-choice",
    questionText: "ما هو 2+2؟",
    correctAnswer: "b",
    options: [{ optionText: "3", valueText: "a" }, { optionText: "4", valueText: "b" }],
    difficulty: "easy",
    _gen: { confidence: 0.9 },
  },
];

beforeEach(() => {
  clearProviders();
  resetAll();
  resetGenerationCacheAdapter();
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
});

describe("question-generation workflow", () => {
  it("generates draft questions via fake provider", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: draftQuestions }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "question-generation",
      feature: "repository",
      context: { subject: "math", grade: "g1" },
      generationParams: { difficulty: "easy", questionCount: 1, questionTypes: ["multiple-choice"] },
    });

    expect(result.status).toBe("ok");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].type).toBe("multiple-choice");
    expect(result.artifact.type).toBe("draft-questions");
    expect(result.artifact.parentId).toBeNull();
  });

  it("image-choice is never emitted by assert", async () => {
    const badQuestions = [{ type: "image-choice", questionText: "x", correctAnswer: "a" }];
    registerProvider(makeFakeProvider({ id: "fake", object: badQuestions }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "question-generation",
      feature: "repository",
      context: { subject: "math" },
      generationParams: { difficulty: "easy", questionCount: 1, questionTypes: ["multiple-choice"] },
    });
    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("caches generation results", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: draftQuestions }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const first = await ai({
      type: "question-generation",
      feature: "repository",
      context: { subject: "math" },
      generationParams: { difficulty: "easy", questionCount: 1, questionTypes: ["multiple-choice"] },
    });
    expect(first.cacheHit).toBe(false);

    const second = await ai({
      type: "question-generation",
      feature: "repository",
      context: { subject: "math" },
      generationParams: { difficulty: "easy", questionCount: 1, questionTypes: ["multiple-choice"] },
    });
    expect(second.cacheHit).toBe(true);
  });
});