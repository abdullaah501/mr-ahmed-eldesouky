import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearProviders, registerProvider } from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import inspectStage from "../../lib/ai/workflows/missingInfoCollection/stages/inspectStage";

// Grade options are DB-sourced now — provide the collection mock so the
// inspect stage classifies against the canonical grade names.
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

function freshCtx(context = null, answers = null, params = {}) {
  return {
    inputs: { context, answers, generationParams: params },
    outputs: {},
  };
}

beforeEach(() => {
  clearProviders();
  resetAll();
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
});

describe("missingInfoCollection inspectStage", () => {
  it("is stateless: same ctx twice → identical output", async () => {
    const ctx1 = freshCtx({ subject: "math", grade: "g1" }, null, { questionCount: 5 });
    const ctx2 = freshCtx({ subject: "math", grade: "g1" }, null, { questionCount: 5 });
    await inspectStage.run(ctx1);
    await inspectStage.run(ctx2);
    expect(JSON.stringify(ctx2.outputs.missingFields)).toBe(JSON.stringify(ctx1.outputs.missingFields));
  });

  it("reports absent required fields", async () => {
    const ctx = freshCtx(null, null, {});
    await inspectStage.run(ctx);
    const missing = ctx.outputs.missingFields;
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some((f) => f.key === "grade" && f.required)).toBe(true);
    expect(missing.some((f) => f.key === "subject" && f.required)).toBe(true);
    expect(missing.some((f) => f.key === "questionCount" && f.required)).toBe(true);
  });

  it("includes priority/required/editable on every entry", async () => {
    const ctx = freshCtx(null, null, {});
    await inspectStage.run(ctx);
    for (const f of ctx.outputs.missingFields) {
      expect(typeof f.priority).toBe("number");
      expect(typeof f.required).toBe("boolean");
      expect(typeof f.editable).toBe("boolean");
      expect(f.reason).toMatch(/absent|low-confidence|present/);
    }
  });

  it("marks low-confidence context fields as missing", async () => {
    const ctx = freshCtx({ subject: { value: "math", confidence: 0.2 }, grade: "g1" }, null, { questionCount: 5, questionTypes: ["multiple-choice"], difficulty: "easy" });
    await inspectStage.run(ctx);
    const subjectField = ctx.outputs.missingFields.find((f) => f.key === "subject");
    expect(subjectField).toBeTruthy();
    expect(subjectField.reason).toBe("low-confidence");
  });

  it("merges answers and reports complete when all required filled", async () => {
    const ctx = freshCtx({ subject: "الرياضيات", grade: "الصف الأول الثانوي" }, {
      difficulty: "easy",
      questionCount: 5,
      questionTypes: ["multiple-choice"],
    }, {});
    await inspectStage.run(ctx);
    expect(ctx.outputs.isComplete).toBe(true);
    expect(ctx.inputs.generationParams.difficulty).toBe("easy");
    expect(ctx.inputs.generationParams.questionCount).toBe(5);
  });

  it("returns needInputs for optional fields too (but not required block)", async () => {
    const ctx = freshCtx({ subject: "الرياضيات", grade: "الصف الأول الثانوي" }, { difficulty: "easy", questionCount: 5, questionTypes: ["multiple-choice"] }, {});
    await inspectStage.run(ctx);
    expect(ctx.outputs.isComplete).toBe(true);
    const optional = ctx.outputs.missingFields.filter((f) => !f.required);
    expect(optional.some((f) => f.key === "bloomLevel")).toBe(true);
  });
});