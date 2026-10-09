export function languageRules(ctx) {
  const lang = ctx.language || "auto";
  return `استخدم لغة المصدر (${lang}) لصياغة الأسئلة والمصطلحات. حافظ على الاتجاه RTL للعربية.`;
}