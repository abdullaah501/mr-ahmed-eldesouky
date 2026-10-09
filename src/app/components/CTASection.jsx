import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import LabGlassware from "./brand/LabGlassware";
import Reveal from "./ui/Reveal";
import checkUser from "../../../lib/checkUser";

export default async function CTASection() {
  const { user, success } = await checkUser();
  if (user && success) return null;

  return (
    <section
      id="cta-signup"
      aria-labelledby="cta-heading"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
    >
      <Reveal scroll>
      <div className="relative overflow-hidden rounded-3xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] p-8 sm:p-10 lg:p-12">
        <div
          className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
        />
        <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -left-4 hidden opacity-80 sm:block"
        >
          <LabGlassware size={200} variant="dark" animated />
        </div>
        <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-right">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold text-white/70">
              جاهز تبدأ؟
            </p>
            <h2
              id="cta-heading"
              className="mt-2 text-2xl font-extrabold leading-snug text-white sm:text-3xl lg:text-4xl"
            >
              جاهز تبدأ رحلتك للتفوق في الكيمياء؟
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80 sm:text-base">
              اعمل حسابك دلوقتي — اختبر مستواك في دقايق واعرف بالظبط محتاج
              تحسّن إيه.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFB81C] px-8 py-3.5 text-sm font-extrabold text-[#3D2C00] shadow-md transition-all hover:bg-[#E9A400] active:scale-[0.98]"
            >
              سجّل الآن
              <LuArrowLeft size={14} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border-2 border-white/30 bg-white/10 px-8 py-3.5 text-sm font-extrabold text-white backdrop-blur transition-all hover:bg-white hover:text-[#073B40] active:scale-[0.98]"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/90">
            شرح الدروس
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/90">
            الكورسات
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/90">
            المراجعات
          </span>
          <span className="rounded-full bg-[#FFB81C] px-3 py-1 text-xs font-bold text-[#3D2C00]">
            تصحيح فوري
          </span>
        </div>
      </div>
      </Reveal>
    </section>
  );
}
