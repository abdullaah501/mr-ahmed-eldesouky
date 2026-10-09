import { normalizeImport } from "../normalize/normalizeImport";

export async function normalizeStage(ctx) {
  if (!ctx.rawQuestions || ctx.rawQuestions.length === 0) {
    return {
      success: false,
      fatal: true,
      errors: [{ code: "NO_QUESTIONS", message: "The file contains no questions", stage: "normalize" }],
    };
  }

  const result = normalizeImport(ctx.rawQuestions);
  ctx.questions = result.questions;
  ctx.stats.normalized = result.questions.length;
  ctx.metadata = { ...(ctx.metadata || {}), ...(ctx.rawMetadata || {}) };

  const warnings = result.warnings || [];
  if (result.questions.length < ctx.rawQuestions.length) {
    warnings.push({
      code: "SKIPPED_ITEMS",
      message: `${ctx.rawQuestions.length - result.questions.length} records were skipped because they are invalid`,
      stage: "normalize",
    });
  }

  return { success: true, warnings };
}
