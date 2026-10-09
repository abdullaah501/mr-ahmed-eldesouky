import Link from "next/link";
import AtomOrbit from "./components/brand/AtomOrbit";
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#073B40] bg-card text-center shadow-sm">
        <div className="relative flex flex-col items-center bg-gradient-to-bl from-[#073B40] to-[#0B5155] px-8 pb-6 pt-8 text-white">
          <div
            aria-hidden
            className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
          />
          <AtomOrbit size={84} variant="dark" animated />
          <p
            dir="ltr"
            aria-hidden
            className="relative mt-3 text-6xl font-black tracking-tight text-white"
          >
            4<span className="text-[#FFB81C]">0</span>4
          </p>
          <p
            aria-hidden
            dir="ltr"
            className="relative mt-1 text-xs font-bold tracking-[0.3em] text-white/50"
          >
            H₂O • NaCl • pH
          </p>
        </div>
        <div className="p-8 pt-6">
          <h1 className="text-lg font-black text-text-primary">
            الصفحة غير موجودة
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            عذراً، الصفحة اللي بتدور عليها مش موجودة أو اتنقلت. ارجع
            للرئيسية وكمّل رحلتك في الكيمياء.
          </p>
          <div className="mt-6 grid gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--brand-amber)] bg-[var(--brand-amber)] px-6 py-3 text-sm font-black text-[var(--brand-amber-ink)] hover:bg-[var(--brand-amber-hover)] hover:border-[var(--brand-amber-hover)]"
            >
              العودة للرئيسية
            </Link>
            <Link
              href="/userDashboard/exams"
              className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-card px-6 py-3 text-sm font-bold text-text-secondary hover:border-[var(--brand-navy-border)] hover:text-[var(--brand-navy)]"
            >
              روح على اختباراتي
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
