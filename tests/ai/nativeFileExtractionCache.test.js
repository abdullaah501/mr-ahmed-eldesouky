import { describe, it, expect, beforeEach, vi } from "vitest";
import { ai } from "../../lib/ai";
import {
  clearProviders,
  registerProvider,
} from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { makeFakeProvider } from "./helpers/fakeProvider";
import * as extractionCache from "../../lib/ai/cache/extractionCache";

// Native-file knowledge extraction must be cacheable: the normalization stage
// derives ctx.fileHash from the file bytes, so the extraction cache key is
// content-addressed instead of being skipped (the pre-fix behavior).

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

const fileInput = (name, type, bytes) => ({
  name,
  type,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

function registerNativeProvider() {
  const provider = makeFakeProvider({
    id: "native-files",
    object: validContext,
  });
  registerProvider(provider);
  return provider;
}

beforeEach(() => {
  clearProviders();
  resetAll();
  extractionCache.resetCacheAdapter();
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_PROVIDER_DISABLED;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
  vi.clearAllMocks();
});

describe("native-file extraction caching", () => {
  it("caches a PDF extraction under a content-derived ai:ext key", async () => {
    const provider = registerNativeProvider();

    const result = await ai({
      type: "knowledge-extraction",
      input: fileInput("lesson.pdf", "application/pdf", [1, 2, 3]),
      prefer: "native-files",
      model: "fake-model",
    });

    expect(result.status).toBe("ok");
    expect(result.cacheHit).toBe(false);
    expect(provider._getCalls()).toBe(1);

    expect(extractionCache.setExtraction).toHaveBeenCalledTimes(1);
    const [key, value] = vi.mocked(extractionCache.setExtraction).mock.calls[0];
    expect(key).toMatch(/^ai:ext:[0-9a-f]{40}$/);
    // The key is derived from the file content hash: same normalizedInput
    // component as a text extraction of the same bytes.
    expect(value.context.subject).toBe("math");
    expect(value.provider).toBe("native-files");
  });

  it("serves a repeat native-file extraction from cache without calling the provider", async () => {
    const provider = registerNativeProvider();
    const task = {
      type: "knowledge-extraction",
      input: fileInput("lesson.pdf", "application/pdf", [4, 5, 6]),
      prefer: "native-files",
      model: "fake-model",
    };

    const first = await ai({ ...task });
    expect(first.cacheHit).toBe(false);
    expect(provider._getCalls()).toBe(1);

    const second = await ai({ ...task });
    expect(second.cacheHit).toBe(true);
    expect(provider._getCalls()).toBe(1); // no additional provider call
    expect(second.context.subject).toBe("math");
  });

  it("uses different cache keys for different file contents and reuses them", async () => {
    registerNativeProvider();
    const taskA = {
      type: "knowledge-extraction",
      input: fileInput("a.pdf", "application/pdf", [1, 2, 3]),
      prefer: "native-files",
      model: "fake-model",
    };
    const taskB = {
      type: "knowledge-extraction",
      input: fileInput("b.pdf", "application/pdf", [7, 8, 9]),
      prefer: "native-files",
      model: "fake-model",
    };

    await ai({ ...taskA });
    await ai({ ...taskB });
    const keys = vi.mocked(extractionCache.setExtraction).mock.calls.map(
      ([key]) => key
    );
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((k) => /^ai:ext:[0-9a-f]{40}$/.test(k))).toBe(true);

    // Re-running the first file must hit ITS cache entry, not write again.
    const again = await ai({ ...taskA });
    expect(again.cacheHit).toBe(true);
    expect(vi.mocked(extractionCache.setExtraction).mock.calls).toHaveLength(2);
  });

  it("computes fileHash for task-provided native files (no degenerate key)", async () => {
    registerNativeProvider();
    const task = (bytes) => ({
      type: "knowledge-extraction",
      useNativeFile: true,
      nativeFileRef: { buffer: Buffer.from(bytes), mimeType: "application/pdf" },
      prefer: "native-files",
      model: "fake-model",
    });

    const result = await ai(task([9, 9, 9]));
    expect(result.status).toBe("ok");
    expect(extractionCache.setExtraction).toHaveBeenCalledTimes(1);
    const key1 = vi.mocked(extractionCache.setExtraction).mock.calls[0][0];
    expect(key1).toMatch(/^ai:ext:[0-9a-f]{40}$/);

    // Different content must produce a different key — this is exactly the
    // degenerate-key hazard the file hash eliminates.
    await ai(task([5, 5, 5]));
    const keys = vi.mocked(extractionCache.setExtraction).mock.calls.map(
      ([key]) => key
    );
    expect(new Set(keys).size).toBe(2);
  });
});
