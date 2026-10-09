import { WorkflowEngine } from "../../engine/WorkflowEngine";
import { registerWorkflow } from "../../engine/workflowRegistry";
import resourceNormalizationStage from "./stages/resourceNormalizationStage";
import aiExtractionStage from "./stages/aiExtractionStage";

const workflow = {
  id: "knowledge-extraction",
  stages: [resourceNormalizationStage, aiExtractionStage],

  async run(task) {
    const engine = new WorkflowEngine(this.stages);
    const ctx = {
      feature: task.feature || "repository",
      input: task.input,
      hints: task.hints || {},
      promptVersion: task.promptVersion,
      model: task.model,
      prefer: task.prefer,
      skipCache: Boolean(task.skipCache),
      useNativeFile: Boolean(task.useNativeFile),
      nativeFileRef: task.nativeFileRef || null,
      fileHash: task.fileHash || null,
      preferredAdapter: task.preferredAdapter || null,
    };

    const result = await engine.run(ctx);

    return {
      status: result.status,
      context: result.output,
      cacheHit: result.cacheHit || false,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      cost: result.cost,
      retries: result.retries,
      events: result.events,
      timings: result.timings,
      warnings: result.warnings,
      errors: result.errors,
      promptId: result.promptId || "knowledge-extraction",
      promptVersion: result.promptVersion,
      totalDurationMs: result.totalDurationMs,
    };
  },
};

registerWorkflow("knowledge-extraction", workflow);
export default workflow;