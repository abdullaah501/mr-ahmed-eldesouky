import { normalize } from "../../../src/question-system/plugins/registry";

import "../../../src/question-system/plugins/multiple-choice/core";
import "../../../src/question-system/plugins/true-false/core";
import "../../../src/question-system/plugins/essay/core";
import "../../../src/question-system/plugins/fill-blank/core";
import "../../../src/question-system/plugins/matching/core";
import "../../../src/question-system/plugins/image-choice/core";

export function mapQuestion(question, ctx) {
  const defaults = ctx.metadata?.defaults || {};

  if (defaults.grade && !question.grade) question.grade = defaults.grade;
  if (defaults.subject && !question.subject) question.subject = defaults.subject;
  if (defaults.difficulty && !question.difficulty) question.difficulty = defaults.difficulty;
  if (defaults.tags && (!question.tags || question.tags.length === 0)) {
    question.tags = [...defaults.tags];
  }

  const payload = {
    ...question,
    source: "import",
    importSource: ctx.plugin?.id || "unknown",
    importSourceId: ctx.importSourceId,
    status: "draft",
  };

  return normalize(payload.type, payload);
}
