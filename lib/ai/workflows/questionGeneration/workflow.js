import { WorkflowEngine } from "../../engine/WorkflowEngine";
import { registerWorkflow } from "../../engine/workflowRegistry";
import aiQuestionGenerationStage from "./stages/aiQuestionGenerationStage";

const workflow = {
  id: "question-generation",
  stages: [aiQuestionGenerationStage],

  async run(task) {
    const engine = new WorkflowEngine(this.stages, { emitter: task.emitter });
    const ctx = {
      taskId: task.taskId,
      feature: task.feature || "repository",
      workflow: this.id,
      provider: null,
      model: task.model || null,
      prefer: task.prefer,
      skipCache: Boolean(task.skipCache),
      promptVersion: task.promptVersion,
      preferredAdapter: task.preferredAdapter || null,
      parentArtifactId: task.parentArtifactId || null,
      inputs: {
        context: task.context || null,
        generationParams: task.generationParams || {},
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
      artifact: result.artifacts?.draftQuestions || null,
      questions: result.outputs?.questions || [],
      cacheHit: result.cacheHit || false,
      provider: result.provider,
      model: result.model,
      cost: result.cost,
      retries: result.retries,
      promptVersion: result.promptVersion,
      events: result.events,
      timings: result.timings,
      warnings: result.warnings,
      errors: result.errors,
    };
  },
};

registerWorkflow("question-generation", workflow);
export default workflow;