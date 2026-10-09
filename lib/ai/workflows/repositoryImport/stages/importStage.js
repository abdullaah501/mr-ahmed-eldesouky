import { resolveOutputTarget } from "../../../outputTargets";
import { wrapEnvelope } from "../../shared/envelope";

const stage = {
  name: "repository-import",
  async run(ctx) {
    const artifact = ctx.inputs.canonicalArtifact;
    if (!artifact || artifact.type !== "canonical-json") {
      return {
        fatal: true,
        errors: [{ stage: "repository-import", code: "AI_NO_CANONICAL", message: "Expected a canonical-json artifact" }],
      };
    }

    const target = ctx.target || "repository";
    const outputTarget = resolveOutputTarget(target);
    if (!outputTarget) {
      return {
        fatal: true,
        errors: [{ stage: "repository-import", code: "AI_NO_OUTPUT_TARGET", message: `No output target "${target}"` }],
      };
    }

    const metadata = {
      userId: ctx.inputs.userId || ctx.user?.id || null,
      requestId: ctx.requestId || null,
    };

    let result;
    try {
      result = await outputTarget.write({
        artifact,
        metadata,
        options: { ...(ctx.importOptions || {}) },
      });
    } catch (err) {
      return {
        fatal: true,
        errors: [{ stage: "repository-import", code: "AI_IMPORT_FAILED", message: err?.message || "import failed" }],
      };
    }

    ctx.outputs.importResult = result;

    const reportArtifact = wrapEnvelope(
      "import-report",
      "1",
      { ok: result.ok, target: result.target, report: result.report, errors: result.errors || [] },
      {
        taskId: ctx.taskId,
        provider: ctx.provider,
        model: ctx.model,
        promptVersion: ctx.promptVersion,
        schemaVersion: "1",
        createdAt: new Date().toISOString(),
      },
      artifact.id
    );

    if (!result.ok) {
      return {
        fatal: true,
        errors: (result.errors || []).map((e) => ({
          stage: "repository-import",
          code: e.code || "AI_IMPORT_FAILED",
          message: e.message || "import error",
        })),
      };
    }

    return { success: true, artifact: reportArtifact };
  },
};

export default stage;