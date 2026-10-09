export async function parseStage(ctx) {
  if (!ctx.plugin) {
    return {
      success: false,
      fatal: true,
      errors: [{ code: "NO_PLUGIN", message: "No plugin resolved for parse", stage: "parse" }],
    };
  }

  try {
    const raw = await ctx.plugin.parse(ctx.buffer, ctx);
    ctx.rawQuestions = raw.questions || [];
    ctx.rawMetadata = raw.rawMetadata || {};
    ctx.stats.parsed = ctx.rawQuestions.length;

    const maxQuestions =
      ctx.options.maxQuestions
      || parseInt(process.env.IMPORT_MAX_QUESTIONS, 10)
      || 100000;

    if (ctx.rawQuestions.length > maxQuestions) {
      return {
        success: false,
        fatal: true,
        errors: [{
          code: "TOO_MANY_QUESTIONS",
          message: `The file contains ${ctx.rawQuestions.length} questions (maximum ${maxQuestions})`,
          stage: "parse",
        }],
      };
    }

    return { success: true };
  } catch (e) {
    const isNotImplemented = /not implemented/i.test(e.message);
    return {
      success: false,
      fatal: true,
      errors: [
        {
          code: isNotImplemented ? "NOT_IMPLEMENTED" : "PARSE_FAILED",
          message: isNotImplemented
            ? `Importing ${ctx.plugin.label} is not currently available`
            : `Failed to parse the file: ${e.message}`,
          stage: "parse",
        },
      ],
    };
  }
}
