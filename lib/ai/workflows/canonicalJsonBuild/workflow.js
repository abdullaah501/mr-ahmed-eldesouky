import { WorkflowEngine } from "../../engine/WorkflowEngine";
import { registerWorkflow } from "../../engine/workflowRegistry";
import buildCanonicalStage from "./stages/buildCanonicalStage";
import preflightStage from "./stages/preflightStage";

const workflow = {
  id: "canonical-json-build",
  stages: [buildCanonicalStage, preflightStage],

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
      defaults: task.defaults || {},
      requestId: task.requestId || null,
      user: { id: task.userId || null },
      inputs: {
        draftArtifact: task.draftArtifact || null,
        context: task.context || null,
        generationParams: task.generationParams || {},
        userId: task.userId || null,
      },
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
      artifact: result.outputs?.canonicalArtifact || null,
      canonicalJson: result.outputs?.canonicalJson || null,
      preflight: result.outputs?.preflight || null,
      preflightOk: result.outputs?.preflight?.ok === true,
      events: result.events,
      timings: result.timings,
      warnings: result.warnings,
      errors: result.errors,
    };
  },
};

registerWorkflow("canonical-json-build", workflow);
export default workflow;