import { describe, it, expect, beforeEach, vi } from "vitest";
import { ai } from "../../lib/ai";
import {
  clearProviders,
  registerProvider,
} from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import * as breakerMod from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { resetCacheAdapter } from "../../lib/ai/cache/extractionCache";

const _resetCache = () => resetCacheAdapter();
import { makeFakeProvider } from "./helpers/fakeProvider";

vi.mock("../../lib/ai/cache/extractionCache", async (importOriginal) => {
  const orig = await importOriginal();
  let mem = new Map();
  return {
    ...orig,
    buildKey: orig.buildKey,
    getExtraction: vi.fn(async (key) => (mem.has(key) ? mem.get(key) : null)),
    setExtraction: vi.fn(async (key, value) => {
      mem.set(key, value);
      return true;
    }),
    resetCacheAdapter: () => {
      mem = new Map();
    },
  };
});

const validContext = {
  subject: "math",
  grade: "grade1",
  language: "en",
  curriculum: { value: "eg", confidence: 0.95 },
  lessonTitle: "Algebra",
  topics: [{ value: "equations", confidence: 0.92 }],
  concepts: [{ value: "variable", confidence: 0.88 }],
  objectives: [{ value: "solve linear equations", confidence: 0.78 }],
  definitions: [{ term: "variable", definition: "a symbol", confidence: 0.91 }],
  formulas: [{ value: "a+b=c", confidence: 0.85 }],
  dates: [],
  terminology: [{ value: "coefficient", confidence: 0.7 }],
  importantFacts: [{ value: "pythagoras", confidence: 0.4 }],
  learningOutcomes: [{ value: "apply formula", confidence: 0.6 }],
  questionHints: [],
  difficultyClues: [],
  missingInformation: ["examples"],
  ambiguities: [],
  unsupportedAreas: [],
  _meta: { overallConfidence: 0.8, language: "en", lowConfidence: [] },
};

beforeEach(() => {
  clearProviders();
  resetAll();
  _resetCache();
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_PROVIDER_DISABLED;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
});

describe("knowledge-extraction workflow", () => {
  it("extracts structured context via the fake provider", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: validContext }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "تفاصيل عن المعادلات الخطية",
      hints: { grade: "grade1", subject: "math" },
    });

    expect(result.status).toBe("ok");
    expect(result.context).toBeTruthy();
    expect(result.context.subject).toBe("math");
    expect(result.context.topics[0].value).toBe("equations");
    expect(result.provider).toBe("fake");
  });

  it("does NOT produce questions or repository JSON", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: validContext }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "x",
    });

    expect(result.context).toBeTruthy();
    expect(Array.isArray(result.context.options)).toBe(false);
    expect(result.context.questionText).toBeUndefined();
    expect(Array.isArray(result.context.correctAnswer)).toBe(false);
  });

  it("collects low-confidence items into _meta.lowConfidence", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: validContext }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "x",
    });

    expect(result.context._meta.lowConfidence).toContain("importantFacts[0]");
  });

  it("falls back to next provider on failure", async () => {
    registerProvider(makeFakeProvider({ id: "bad", failTimes: 5 }));
    registerProvider(makeFakeProvider({ id: "good", object: validContext }));
    process.env.AI_PROVIDER_ORDER = "bad,good";
    reloadAiEnv();

    const result = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "x",
    });

    expect(result.status).toBe("ok");
    expect(result.provider).toBe("good");
  });

  it("fails when no provider configured", async () => {
    const result = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "x",
    });
    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("caches extraction results by content-hash + prompt version", async () => {
    const cache = await import("../../lib/ai/cache/extractionCache");
    cache.resetCacheAdapter();

    registerProvider(makeFakeProvider({ id: "fake", object: validContext }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const first = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "same input text here",
    });
    expect(first.cacheHit).toBe(false);

    const second = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "same input text here",
    });
    expect(second.cacheHit).toBe(true);
  });
});

describe("primitive executors dispatch", () => {
  it("runs a text task", async () => {
    registerProvider(makeFakeProvider({ id: "fake", text: "hello" }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "text",
      feature: "repository",
      messages: [{ role: "user", content: "say hi" }],
    });

    expect(result.text).toBe("hello");
    expect(result.provider).toBe("fake");
  });

  it("runs an object task", async () => {
    registerProvider(makeFakeProvider({ id: "fake", object: { ok: 1 } }));
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({ type: "object", feature: "x", messages: [] });
    expect(result.object).toEqual({ ok: 1 });
  });

  it("rejects unknown task type", async () => {
    await expect(ai({ type: "nope", messages: [] })).rejects.toThrow();
  });
});
