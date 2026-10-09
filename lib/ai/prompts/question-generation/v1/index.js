import { createPromptBuilder } from "../../shared/PromptBuilder";
import { system } from "./system";
import { rules } from "./rules";
import { questionTypeRules } from "./questionTypeRules";
import { bloomRules } from "./bloomRules";
import { outputRules } from "./outputRules";
import { languageRules } from "./languageRules";

export function buildQuestionGenerationPrompt(ctx = {}) {
  const builder = createPromptBuilder();
  const composed = builder
    .add(system)
    .add(rules)
    .add(languageRules)
    .add(questionTypeRules)
    .addIf(ctx.bloomLevel, bloomRules)
    .add(outputRules)
    .build(ctx);

  const contextBlock = buildContextBlock(ctx);
  return composed + "\n\n" + contextBlock;
}

function buildContextBlock(ctx) {
  const context = ctx.structuredContext || {};
  const params = {
    grade: ctx.grade || context.grade,
    subject: ctx.subject || context.subject,
    difficulty: ctx.difficulty,
    questionCount: ctx.questionCount,
    questionTypes: ctx.questionTypes,
    bloomLevel: ctx.bloomLevel,
    outputPreferences: ctx.outputPreferences,
    focusIndex: ctx.focusIndex,
    focusTopic: ctx.focusTopic,
  };

  return `السياق التعليمي المستخرج (StructuredContext):
${JSON.stringify(context, null, 2)}

توجيهات المعلم:
${JSON.stringify(params, null, 2)}`;
}
