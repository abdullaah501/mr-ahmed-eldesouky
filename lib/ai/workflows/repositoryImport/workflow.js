import { WorkflowEngine } from "../../engine/WorkflowEngine";
import { registerWorkflow } from "../../engine/workflowRegistry";
import importStage from "./stages/importStage";

const workflow = {
  id: "repository-import",
  stages: [importStage],

  async run(task) {
    const engine = new WorkflowEngine(this.stages, { emitter: task.emitter });
    const ctx = {
      taskId: task.taskId,
      feature: task.feature || "repository",
      workflow: this.id,
      provider: task.provider || null,
      model: task.model || null,
      promptVersion: task.promptVersion || null,
      target: task.target || "repository",
      requestId: task.requestId || null,
      user: { id: task.userId || null },
      inputs: {
        canonicalArtifact: task.canonicalArtifact || null,
        userId: task.userId || null,
      },
      importOptions: task.importOptions || {},
      outputs: {},
      artifacts: {},
      events: [],
      timings: [],
      warnings: [],
      errors: [],
    };

    const result = await engine.run(ctx);

    return {
      status: result.status,
      importResult: result.outputs?.importResult || null,
      events: result.events,
      timings: result.timings,
      warnings: result.warnings,
      errors: result.errors,
    };
  },
};

registerWorkflow("repository-import", workflow);
export default workflow;