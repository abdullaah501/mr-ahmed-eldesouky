import { NextResponse } from "next/server";
import { ai } from "../../../../../lib/ai/index";
import {
  checkRateLimit,
  incrementRateLimit,
} from "../../../../../lib/rateLimit";

const LIMIT_PER_DAY = 7;

export async function POST(req) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";

  if (!origin.startsWith(process.env.URL)) {
    return NextResponse.json(
      { message: "Unauthorized access." },
      { status: 403 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const today = new Date().toISOString().slice(0, 10);
  const rateKey = `${ip}:${today}`;

  const { allowed } = await checkRateLimit({
    service: "chatbot",
    key: rateKey,
    limit: LIMIT_PER_DAY,
    windowSeconds: 86400,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "Rate limit exceeded." },
      { status: 429 },
    );
  }

  const { message } = await req.json();

  try {
    const result = await ai({
      type: "text",
      feature: "chatbot",
      messages: [
        {
          role: "system",
          content: `أنت مساعد ودود لمنصة أ. أحمد الدسوقي للكيمياء. شكراً لتواصلك. جاوب فقط لو السؤال عن المنصة وخدماتنا.
لو السؤال عام، وجّه الطالب لصفحة الأسئلة الشائعة.
رد دايماً بنفس لغة المستخدم.

معلومات عن منصتنا:
أهلاً بيك في منصة أ. أحمد الدسوقي — الكيمياء. للمرحلة الإعدادية والثانوية.

مهمتنا نخلي الكيمياء سهلة وواضحة لكل طالب.

إزاي المنصة شغالة:
- دروس كيمياء تفاعلية
- أسئلة وتدريبات وامتحانات
- نتايج فورية وتقييم
- راجع إجاباتك وتابع تقدمك
- دعم مباشر للطلبة

مين المستفيد؟
لطلبة الإعدادي والثانوي اللي عايزين يحسّنوا مستواهم في الكيمياء خطوة بخطوة.

الخطط والاشتراك:
بنوفر اشتراك حسب السنة الدراسية بأسعار بسيطة ومناسبة ودعم خاص.

خلي اللينكات زي ما هي من غير تغيير. خلي ردك قصير وبسيط مع إيموجي قليلة. حد أقصى 170 كلمة.
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    // Increment only after a successful AI platform response
    await incrementRateLimit({
      service: "chatbot",
      key: rateKey,
      windowSeconds: 86400,
    });

    return NextResponse.json(
      { reply: result?.text },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { message: "Failed to fetch from OpenRouter." },
      { status: 500 },
    );
  }
}
