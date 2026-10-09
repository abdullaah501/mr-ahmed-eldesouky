import { wrapEnvelope } from "../../shared/envelope";
import { resolveBuilder } from "../builders";

const stage = {
  name: "build-canonical",
  async run(ctx) {
    const draftArtifact = ctx.inputs.draftArtifact;
    if (!draftArtifact || draftArtifact.type !== "draft-questions") {
      return {
        fatal: true,
        errors: [{ stage: "build-canonical", code: "AI_INVALID_ARTIFACT", message: "Expected a draft-questions artifact" }],
      };
    }

    const draftQuestions = draftArtifact.data?.questions || [];
    const target = ctx.target || "repository";
    const builder = resolveBuilder(target);
    if (!builder) {
      return {
        fatal: true,
        errors: [{ stage: "build-canonical", code: "AI_NO_BUILDER", message: `No builder registered for target "${target}"` }],
      };
    }

    const builderCtx = {
      provenance: {
        aiProvider: ctx.provider,
        aiModel: ctx.model,
        aiPromptId: "question-generation",
        aiPromptVersion: ctx.promptVersion,
      },
      params: ctx.inputs.generationParams || {},
      context: ctx.inputs.context || {},
      defaults: ctx.defaults || {},
      feature: ctx.feature || "repository",
    };

    const canonical = await builder.build(draftQuestions, builderCtx);

    const artifact = wrapEnvelope(
      "canonical-json",
      "1",
      canonical,
      {
        taskId: ctx.taskId,
        provider: ctx.provider,
        model: ctx.model,
        promptVersion: ctx.promptVersion,
        schemaVersion: "1",
        createdAt: new Date().toISOString(),
      },
      draftArtifact.id
    );

    ctx.outputs.canonicalJson = canonical;
    ctx.outputs.canonicalArtifact = artifact;

    return { success: true, artifact };
  },
};

export default stage;