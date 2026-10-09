import { WorkflowEngine } from "../../engine/WorkflowEngine";
import { registerWorkflow } from "../../engine/workflowRegistry";
import inspectStage from "./stages/inspectStage";
import { wrapEnvelope } from "../shared/envelope";

const workflow = {
  id: "missing-info-collection",
  stages: [inspectStage],

  async run(task) {
    const engine = new WorkflowEngine(this.stages, { emitter: task.emitter });
    const ctx = {
      taskId: task.taskId,
      feature: task.feature || "repository",
      workflow: this.id,
      inputs: {
        context: task.context || null,
        answers: task.answers || null,
        generationParams: task.generationParams || {},
      },
      outputs: {},
      events: [],
      timings: [],
      warnings: [],
      errors: [],
    };

    await engine.run(ctx);

    const missingFields = ctx.outputs.missingFields || [];
    const isComplete = ctx.outputs.isComplete !== false;

    const producerMeta = {
      taskId: ctx.taskId,
      provider: null,
      model: null,
      promptVersion: null,
      schemaVersion: "1",
      createdAt: new Date().toISOString(),
    };

    if (!isComplete) {
      const artifact = wrapEnvelope(
        "missing-data-request",
        "1",
        { status: "needs-input", missingFields, context: ctx.inputs.context },
        producerMeta,
        task.parentArtifactId || null
      );
      return {
        status: "needs-input",
        artifact,
        missingFields,
        context: ctx.inputs.context,
        events: ctx.events,
        timings: ctx.timings,
        errors: ctx.errors,
      };
    }

    const artifact = wrapEnvelope(
      "structured-context",
      "1",
      { status: "complete", context: ctx.inputs.context },
      producerMeta,
      task.parentArtifactId || null
    );
    return {
      status: "complete",
      artifact,
      context: ctx.inputs.context,
      generationParams: ctx.inputs.generationParams,
      events: ctx.events,
      timings: ctx.timings,
      errors: ctx.errors,
    };
  },
};

registerWorkflow("missing-info-collection", workflow);
export default workflow;