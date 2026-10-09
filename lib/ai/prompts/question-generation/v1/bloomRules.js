export function bloomRules(ctx) {
  const level = ctx.bloomLevel;
  if (!level) return "";
  return `مستوى بلوم المستهدف: ${level}. وجّه مستوى التفكير (تذكر/فهم/تطبيق/تحليل/تركيب/تقييم) ليناسب هذا المستوى.`;
}