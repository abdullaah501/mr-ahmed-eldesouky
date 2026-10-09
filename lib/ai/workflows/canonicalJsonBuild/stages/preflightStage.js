import { resolveOutputTarget } from "../../../outputTargets";

const stage = {
  name: "preflight",
  async run(ctx) {
    const artifact = ctx.outputs.canonicalArtifact;
    if (!artifact || artifact.type !== "canonical-json") {
      return {
        fatal: true,
        errors: [{ stage: "preflight", code: "AI_NO_CANONICAL", message: "No canonical-json artifact to pre-flight" }],
      };
    }

    const target = ctx.target || "repository";
    const outputTarget = resolveOutputTarget(target);
    if (!outputTarget) {
      return {
        fatal: true,
        errors: [{ stage: "preflight", code: "AI_NO_OUTPUT_TARGET", message: `No output target "${target}"` }],
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
        options: { dryRun: true, ...(ctx.preflightOptions || {}) },
      });
    } catch (err) {
      return {
        fatal: true,
        errors: [{ stage: "preflight", code: "AI_PREFLIGHT_FAILED", message: err?.message || "pre-flight failed" }],
      };
    }

    ctx.outputs.preflight = result;

    if (!result.ok) {
      return {
        fatal: false,
        success: true,
        warnings: (result.errors || []).map((e) => ({
          stage: "preflight",
          code: e.code || "AI_PREFLIGHT_ERROR",
          message: e.message || "pre-flight validation error",
        })),
      };
    }

    return { success: true };
  },
};

export default stage;