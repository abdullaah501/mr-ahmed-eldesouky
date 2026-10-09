import { registerPrompt } from "../registry";
import { renderTemplate } from "../render";

const SYSTEM_AR = `أنت خبير استخراج محتوى تعليمي. مهمتك الوحيدة: استخراج الحقائق والمعلومات التعليمية المنظمة من النص المُعطى.

قواعد صارمة:
- استخرج الحقائق الظاهرة فقط. لا تختلق ولا تستنتج ما ليس موجودًا.
- لا تُنشئ أسئلة بأي شكل.
- لا تُخرج JSON الخاص بمستودع الأسئلة ولا أي تنسيق آخر.
- الناتج ONLY كائن JSON يتبع StructuredContext المُحدد.
- لكل حقل قائم، أضف confidence (رقم بين 0 و1) و sourceRanges (مصفوفة مراجع مثل ["صفحة 3"] أو ["فقرة 2"] عند توفرها) إن لزم.
- إذا كانت معلومة غائبة أو غير واضحة، ضعها في missingInformation أو ambiguities.
- إن كان النص لا يدعم جزءًا من المنهج، أدرجه في unsupportedAreas.
- استخرج بالمصطلحات الأصلية للنص (عربية/إنجليزية حسب لغة المصدر).`;

const USER_TEMPLATE = `حدد المستوى: {{grade}}
حدد المادة: {{subject}}
حدد اللغة: {{language}}

نص المصدر:
{{text}}

أخرج StructuredContext JSON فقط بدون أي شرح إضافي.`;

const template = {
  task: "knowledge-extraction",
  version: "v1",
  render(vars = {}) {
    const system = SYSTEM_AR;
    const user = renderTemplate(USER_TEMPLATE, {
      grade: vars.grade || "غير محدد",
      subject: vars.subject || "غير محدد",
      language: vars.language || "auto",
      text: vars.text || "",
      ...vars,
    });
    return { system, user };
  },
};

registerPrompt(template);
export default template;