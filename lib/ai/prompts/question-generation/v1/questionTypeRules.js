export function questionTypeRules(ctx) {
  const types = (ctx.questionTypes || ["multiple-choice", "true-false", "essay", "fill-blank", "matching"]).join("، ");
  return `أنواع الأسئلة المطلوبة: ${types}.

- multiple-choice: options[] مصفوفة (2-4 خيارات) بـ {optionText, valueText} + correctAnswer = valueText الصحيح.
- true-false: correctAnswer = "true" أو "false" (أحرف صغيرة دائماً — لا تستخدم "صح" أو "خطأ" ولا أي صيغة أخرى في هذا الحقل، فهو قيمة مخططية وليست نصاً).
- essay: correctAnswer إلزامي — إجابة نموذجية موجزة ووافية تمثل ما يجب أن تحتويه إجابة الطالب المتقن؛ لا تتركها فارغة أبداً ولا تكرر نص السؤال.
- fill-blank: questionText يجب أن يحوي ____ + config.answers[] بـ {id, text, isCorrect} (إجابة صحيحة واحدة بالضبط).
- matching: config.pairs[] بـ {id, leftItem, rightItem} (زوجان على الأقل).
- image-choice: غير مسموح في التوليد النصي — لا تستخدمه.`;
}