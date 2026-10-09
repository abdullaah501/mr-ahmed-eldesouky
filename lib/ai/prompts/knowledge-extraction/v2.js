import { registerPrompt } from "../registry";
import { renderTemplate } from "../render";

const SYSTEM_AR = `أنت خبير استخراج محتوى تعليمي. مهمتك: استخراج المعلومات التعليمية المنظمة من النص.

إرشادات:
1) استخرج فقط الحقائق الموجودة صراحةً في النص. شيء غير موجود → لا تستنتجه.
2) لا تُنشئ أسئلة على الإطلاق.
3) الناتج كائن JSON صارم يتبع StructuredContext.
4) كل حقل مصفوفة: كل عنصر يحمل {value, confidence (0..1), sourceRanges[]}.
5) الثقة المنخفضة (أقل من 0.5) مقبولة لكنها ستوضع ضمن _meta.lowConfidence لاحقًا.
6) المعلومات المفقودة/الغامضة/غير المدعومة → ضعها في الأقسام المخصصة.
7) التزم بلغة المصدر للمصطلحات.
8) إذا قدّم المعلم المادة أو الصف أو عنوان الدرس، فهذه قيم مرجعية موثوقة: استخدمها كما هي في الحقول المقابلة ولا تناقضها أو تستبدلها بقيمة مستنتجة.
9) استخرج الموضوعات والمفاهيم الفعلية من النص، ولا تخترع معلومة تعليمية غير موجودة.

المخطط المرجعي:
StructuredContext = {
  subject, grade, language, curriculum, lessonTitle,
  topics[], concepts[], objectives[], definitions[],
  formulas[], dates[], terminology[], importantFacts[],
  learningOutcomes[], questionHints[], difficultyClues[],
  missingInformation[], ambiguities[], unsupportedAreas[],
  _meta { schemaVersion, overallConfidence, language, lowConfidence[], provider, model, promptId, promptVersion, extractedAt }
}`;

const USER_TEMPLATE = `تلميحات الاختيار:
- المادة: {{subject}}
- الصف: {{grade}}
- عنوان الدرس: {{lessonTitle}}
- اللغة: {{language}}

النص:
{{text}}

أعد StructuredContext JSON فقط.`;

const template = {
  task: "knowledge-extraction",
  version: "v2",
  render(vars = {}) {
    const system = SYSTEM_AR;
    const user = renderTemplate(USER_TEMPLATE, {
      grade: vars.grade || "غير محدد",
      subject: vars.subject || "غير محدد",
      lessonTitle: vars.lessonTitle || "غير محدد",
      language: vars.language || "auto",
      text: vars.text || "",
      ...vars,
    });
    return { system, user };
  },
};

registerPrompt(template);
export default template;
