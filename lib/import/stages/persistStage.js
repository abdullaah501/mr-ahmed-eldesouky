import { bulkCreateQuestions } from "../../repository/questionService";
import { processQuestionImages } from "../images/processQuestionImages";

export async function persistStage(ctx) {
  if (ctx.mappedItems.length === 0) {
    return {
      success: true,
      warnings: [
        {
          code: "NOTHING_TO_PERSIST",
          message: "No valid questions to add to the repository",
          stage: "persist",
        },
      ],
    };
  }

  const imageWarnings = await processQuestionImages(ctx.mappedItems);
  if (imageWarnings.length > 0) {
    ctx.warnings.push(...imageWarnings);
  }

  const result = await bulkCreateQuestions(ctx.mappedItems, {
    userId: ctx.userId,
    batchSize: ctx.options.batchSize || 100,
  });

  ctx.stats.inserted = result.insertedCount || 0;

  const persistErrors = (result.errors || []).map((e) => ({
    code: "PERSIST_FAILED",
    message: e.message || "Failed to save the question",
    questionIndex: e.index,
    stage: "persist",
  }));

  if (persistErrors.length > 0) {
    ctx.stats.failed += persistErrors.length;
  }

  return { success: true, errors: persistErrors, warnings: [] };
}
