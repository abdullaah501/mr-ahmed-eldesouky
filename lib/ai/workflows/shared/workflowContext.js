import crypto from "crypto";

export function makeWorkflowContext(task = {}) {
  const ctx = {
    taskId: task.taskId || crypto.randomUUID(),
    feature: task.feature || "repository",
    workflow: task.workflow || null,
    provider: task.provider || null,
    model: task.model || null,
    budgetProfile: task.budgetProfile || null,
    cachePolicy: task.cachePolicy || null,
    promptVersion: task.promptVersion || null,
    schemaVersion: task.schemaVersion || null,
    user: { id: task.userId || null },
    requestId: task.requestId || null,
    metadata: { ...(task.metadata || {}) },

    inputs: {},
    artifacts: {},
    outputs: {},
  };

  ctx.inputs.context = task.context || null;
  ctx.inputs.answers = task.answers || null;
  ctx.inputs.generationParams = task.generationParams || null;
  ctx.inputs.canonicalArtifact = task.canonicalArtifact || null;

  return ctx;
}