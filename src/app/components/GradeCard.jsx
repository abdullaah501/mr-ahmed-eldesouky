import Link from "next/link";
import { LuCheck, LuArrowLeft } from "react-icons/lu";

export default function GradeCard({ item, index }) {
  const name = item?.grade || "الصف الدراسي";
  const isSecondary = /ثانوي|Secondary/i.test(name);
  const isPrep = /إعدادي|اعدادي|Preparatory/i.test(name);
  const levelLabel = isSecondary ? "ثانوي" : isPrep ? "إعدادي" : "الكيمياء";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-[var(--brand-navy-border)]">
      {/* band header */}
      <div className="relative overflow-hidden bg-gradient-to-bl from-[#073B40] to-[#0B5155] px-5 pb-4 pt-5 text-white">
        <div
          aria-hidden
          className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
        />
        <span
          aria-hidden
          dir="ltr"
          className="pointer-events-none absolute -bottom-5 left-2 select-none text-[88px] font-black leading-none text-white/[0.08]"
        >
          {String(index).padStart(2, "0")}
        </span>
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB81C] px-3 py-1 text-[11px] font-black text-[#3D2C00]">
            {levelLabel}
          </span>
          <span
            dir="ltr"
            aria-hidden
            className="text-xs font-black tracking-widest text-[#8FE3E4]/80"
          >
            H₂O
          </span>
        </div>
        <h3 className="relative mt-3 line-clamp-2 text-xl font-black leading-snug text-white">
          {name}
        </h3>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[13px] leading-relaxed text-text-muted">
          {isSecondary
            ? "اتحدَّ نفسك مع اختبارات الكيمياء وحسّن مهاراتك في الحل."
            : isPrep
              ? "اتدرّب على الكيمياء واختبر مهاراتك باختبارات معمولة لصفك."
              : "اختبارات تفاعلية بتصحيح فوري ومتابعة لمستواك."}
        </p>
        <ul className="mt-4 mb-5 space-y-2">
          {(
            item?.features || ["اختبارات تفاعلية", "متابعة المستوى", "تصحيح فوري"]
          )
            .slice(0, 3)
            .map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-[13px] font-bold text-text-secondary"
              >
                <span
                  aria-hidden
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
                >
                  <LuCheck size={11} />
                </span>
                {f}
              </li>
            ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs font-semibold text-text-muted">
            #{String(index).padStart(2, "0")}
          </span>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--brand-amber)] bg-[var(--brand-amber)] px-4 py-2 text-sm font-bold text-[var(--brand-amber-ink)] transition-colors hover:bg-[var(--brand-amber-hover)] hover:border-[var(--brand-amber-hover)] active:scale-[0.98]"
          >
            شوف الاختبارات
            <span aria-hidden>
              <LuArrowLeft size={14} />
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
