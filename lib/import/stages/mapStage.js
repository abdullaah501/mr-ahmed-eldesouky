import { mapQuestion } from "../mapper/mapQuestion";

export async function mapStage(ctx) {
  const errors = [];
  const mapped = [];

  for (let i = 0; i < ctx.validQuestions.length; i++) {
    try {
      const payload = mapQuestion(ctx.validQuestions[i], ctx);
      mapped.push(payload);
    } catch (e) {
      errors.push({
        code: "MAP_FAILED",
        message: `Failed to map question to the repository format: ${e.message}`,
        questionIndex: i,
        stage: "map",
      });
      ctx.stats.failed++;
    }
  }

  ctx.mappedItems = mapped;
  ctx.stats.mapped = mapped.length;
  return { success: errors.length === 0, errors };
}
