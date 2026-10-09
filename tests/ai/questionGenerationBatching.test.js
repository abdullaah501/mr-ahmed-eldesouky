import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../lib/ai/prompts/PromptManager", () => ({
  renderPrompt: vi.fn(async (_task, vars) => ({
    text: { system: "S", user: `U:${vars.questionCount}` },
    version: "v2",
  })),
}));

vi.mock("../../lib/ai/executors/taskRunner", () => ({
  runTask: vi.fn(),
}));

vi.mock("../../lib/ai/cache/generationCache", () => ({
  buildGenerationKey: vi.fn(({ generationParams }) => ({
    key: JSON.stringify(generationParams),
  })),
  getGeneration: vi.fn(async () => null),
  setGeneration: vi.fn(),
}));

vi.mock("../../lib/ai/capabilities/staticCapabilities", () => ({
  staticProfile: vi.fn(() => ({})),
}));

vi.mock("../../lib/ai/shared/envelope", () => ({
  wrapEnvelope: vi.fn((type, version, data) => ({ type, version, data })),
}));

import { renderPrompt } from "../../lib/ai/prompts/PromptManager";
import { runTask } from "../../lib/ai/executors/taskRunner";
import { setGeneration } from "../../lib/ai/cache/generationCache";
import stage from "../../lib/ai/workflows/questionGeneration/stages/aiQuestionGenerationStage";

const GID = "cccccccccccccccccccccccc";

function mkQ(i) {
  return { type: "true-false", questionText: `سؤال ${i}`, correctAnswer: "صح" };
}

function makeCtx(questionCount, extraParams = {}) {
  return {
    inputs: {
      context: { grade: "الصف الأول الثانوي", subject: "الرياضيات" },
      generationParams: { questionCount, ...extraParams },
    },
    feature: "repository",
    artifacts: {},
    outputs: {},
    parentArtifactId: null,
    promptVersion: "v2",
    skipCache: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("question generation requested-count batching", () => {
  it("requested 25 → three bounded calls (10+10+5) returning 25 valid questions", async () => {
    let n = 0;
    runTask.mockImplementation(async () => {
      const start = n;
      n += 100;
      return {
        object: Array.from({ length: 10 }, (_, i) => mkQ(start + i)),
        provider: "fake",
        model: "m",
        cost: 0.01,
        retries: 0,
      };
    });

    const ctx = makeCtx(25);
    const res = await stage.run(ctx);

    expect(res.success).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(3);
    const sizes = renderPrompt.mock.calls.map(
      (c) => c[1].questionCount
    );
    expect(sizes).toEqual([10, 10, 5]);
    expect(ctx.outputs.questions).toHaveLength(25);
    expect(ctx.outputs.questions.every((q) => q.type === "true-false")).toBe(true);
  });

  it("requested 50 → 50 questions in 5 batches", async () => {
    runTask.mockImplementation(async (task) => {
      const count = Number(task.messages[1].content.split(":")[1]);
      return {
        object: Array.from({ length: count }, (_, i) => mkQ(i)),
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      };
    });

    const ctx = makeCtx(50);
    const res = await stage.run(ctx);

    expect(res.success).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(5);
    expect(ctx.outputs.questions).toHaveLength(50);
  });

  it("never exceeds the requested count", async () => {
    runTask.mockImplementation(async () => ({
      object: Array.from({ length: 10 }, (_, i) => mkQ(i)),
      provider: "fake",
      model: "m",
      cost: 0,
      retries: 0,
    }));

    const ctx = makeCtx(25);
    await stage.run(ctx);

    expect(ctx.outputs.questions).toHaveLength(25);
  });

  it("provider short batch → bounded continuation, no infinite retries", async () => {
    // Planned calls: ceil(20/10) = 2. First returns 10, second returns 5.
    // Bounded attempts exhausted → 15 returned (no silent collapse to 5,
    // no unbounded looping).
    runTask
      .mockImplementationOnce(async () => ({
        object: Array.from({ length: 10 }, (_, i) => mkQ(i)),
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      }))
      .mockImplementationOnce(async () => ({
        object: Array.from({ length: 5 }, (_, i) => mkQ(10 + i)),
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      }));

    const ctx = makeCtx(20);
    const res = await stage.run(ctx);

    expect(res.success).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(2);
    expect(ctx.outputs.questions).toHaveLength(15);
  });

  it("requested 150 → clamped to the existing max of 100 (10 calls)", async () => {
    runTask.mockImplementation(async (task) => {
      const count = Number(task.messages[1].content.split(":")[1]);
      return {
        object: Array.from({ length: count }, (_, i) => mkQ(i)),
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      };
    });

    const ctx = makeCtx(150);
    const res = await stage.run(ctx);

    expect(res.success).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(10);
    expect(ctx.outputs.questions).toHaveLength(100);
  });

  it("invalid generated questions are not counted as valid output (fatal)", async () => {
    runTask
      .mockImplementationOnce(async () => ({
        object: Array.from({ length: 10 }, (_, i) => mkQ(i)),
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      }))
      .mockImplementationOnce(async () => ({
        object: [{ type: "true-false", correctAnswer: "صح" }], // missing questionText
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      }));

    const ctx = makeCtx(25);
    const res = await stage.run(ctx);

    expect(res.success).toBeUndefined();
    expect(res.fatal).toBe(true);
    expect(res.errors[0].code).toBe("AI_ASSERTION_FAILED");
  });

  it("single-question regeneration (focusIndex) stays a single call", async () => {
    runTask.mockImplementation(async () => ({
      object: [mkQ(1)],
      provider: "fake",
      model: "m",
      cost: 0,
      retries: 0,
    }));

    const ctx = makeCtx(1, { focusIndex: 2, focusTopic: "topic" });
    const res = await stage.run(ctx);

    expect(res.success).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(1);
    expect(ctx.outputs.questions).toHaveLength(1);
  });

  it("multi-batch cache keys are deterministic per batch (batchIndex)", async () => {
    runTask.mockImplementation(async (task) => {
      const count = Number(task.messages[1].content.split(":")[1]);
      return {
        object: Array.from({ length: count }, (_, i) => mkQ(i)),
        provider: "fake",
        model: "m",
        cost: 0,
        retries: 0,
      };
    });

    const ctx = makeCtx(20);
    ctx.skipCache = false;
    await stage.run(ctx);

    const keys = setGeneration.mock.calls.map((c) => c[0]);
    expect(keys).toHaveLength(2);
    expect(JSON.parse(keys[0]).batchIndex).toBe(0);
    expect(JSON.parse(keys[1]).batchIndex).toBe(1);
    expect(JSON.parse(keys[0]).questionCount).toBe(10);
  });
});
