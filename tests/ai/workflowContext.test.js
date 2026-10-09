import { describe, it, expect } from "vitest";
import { makeWorkflowContext } from "../../lib/ai/workflows/shared/workflowContext";

describe("WorkflowContext", () => {
  it("creates a context with required fields", () => {
    const ctx = makeWorkflowContext({ feature: "repository", userId: "u1", workflow: "question-generation" });
    expect(ctx.feature).toBe("repository");
    expect(ctx.workflow).toBe("question-generation");
    expect(ctx.user.id).toBe("u1");
    expect(ctx.taskId).toBeTruthy();
    expect(ctx.inputs).toBeDefined();
    expect(ctx.artifacts).toBeDefined();
    expect(ctx.outputs).toBeDefined();
  });

  it("generates unique taskId per call", () => {
    const a = makeWorkflowContext({});
    const b = makeWorkflowContext({});
    expect(a.taskId).not.toBe(b.taskId);
  });

  it("carries inputs from task", () => {
    const ctx = makeWorkflowContext({ context: { subject: "math" }, answers: { grade: "g1" }, generationParams: { questionCount: 5 } });
    expect(ctx.inputs.context).toEqual({ subject: "math" });
    expect(ctx.inputs.answers).toEqual({ grade: "g1" });
    expect(ctx.inputs.generationParams).toEqual({ questionCount: 5 });
  });
});