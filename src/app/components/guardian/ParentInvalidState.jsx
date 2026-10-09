import Link from "next/link";
import Image from "next/image";
import { LuSigma, LuCheck } from "react-icons/lu";

export default function ParentInvalidState({
 message = "اللينك ده غير صحيح أو انتهت صلاحيته",
}) {
 return (
 <main
 className="min-h-screen bg-[var(--background)] font-amin flex flex-col"
 >
 {/* soft math backdrop — same as HeroSection / Contact */}
 <div className="pointer-events-none absolute inset-0 overflow-hidden">
 <div
 className="absolute inset-0 opacity-[0.04]"
 style={{
 backgroundImage:
 "linear-gradient(var(--brand-navy) 1px, transparent 1px), linear-gradient(90deg, var(--brand-navy) 1px, transparent 1px)",
 backgroundSize: "32px 32px",
 }}
 />
 <div className="absolute -top-28 -right-24 h-[380px] w-[380px] rounded-full bg-[var(--brand-navy-soft)] blur-3xl opacity-60" />
 <div className="absolute -bottom-24 -left-24 h-[340px] w-[340px] rounded-full bg-[var(--brand-teal-soft)] blur-3xl opacity-70" />
 <span
 className="absolute left-[8%] top-[18%] select-none text-7xl font-black text-[var(--brand-navy)] opacity-[0.04]"
 aria-hidden
 >
 <LuSigma size={72} />
 </span>
 <span
 className="absolute right-[10%] top-[30%] select-none text-6xl font-black text-[var(--brand-teal)] opacity-[0.06]"
 aria-hidden
 >
 π
 </span>
 <span
 className="absolute bottom-[18%] right-[22%] select-none text-5xl font-black text-[var(--brand-navy)] opacity-[0.05]"
 aria-hidden
 >
 <LuCheck size={48} />
 </span>
 </div>

 <div className="relative flex flex-1 flex-col">
 {/* minimal brand bar */}
 <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-6">
 <Link
 href="/"
 className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy-border)] bg-card px-2.5 py-1.5 pr-3 shadow-sm hover:shadow-md transition-shadow"
 >
 <Image
 src="/logo.png"
 alt="أ. أحمد الدسوقي — مدرس كيمياء"
 width={28}
 height={28}
 className="h-7 w-7 object-contain"
 />
 <span className="text-xs font-extrabold tracking-wide text-[var(--brand-navy)]">
 أ. أحمد الدسوقي — الكيمياء
 </span>
 <span className="hidden sm:inline-flex rounded-full bg-[var(--brand-teal-soft)] px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-[var(--brand-teal-border)]">
 ابتدائي وإعدادي وثانوي
 </span>
 </Link>
 </div>

 <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
 <div className="w-full max-w-md">
 <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy-border)] bg-card shadow-xl">
 <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)]" />
 <div className="bg-[var(--background)] p-2">
 <div className="rounded-2xl bg-card p-8 sm:p-10 text-center">
 <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 border border-red-200 text-red-500 mb-5">
 <svg
 width="26"
 height="26"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden
 >
 <circle cx="12" cy="12" r="10" />
 <line x1="12" y1="8" x2="12" y2="12" />
 <line x1="12" y1="16" x2="12.01" y2="16" />
 </svg>
 </div>
 <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)] px-3 py-1">
 <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
 <span className="text-[11px] font-extrabold tracking-wide text-[var(--brand-navy)]">
 لينك خاص لولي الأمر
 </span>
 </div>
 <h1 className="mt-4 text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">
 متابعة ولي الأمر
 </h1>
 <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
 {message}
 </p>
 <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
 اطلب من الطالب يعمل لينك جديد من لوحته لو اللينك ده انتهى.
 </p>
 <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
 <Link
 href="/"
 className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-navy)] px-6 py-3 text-sm font-extrabold text-white shadow-md transition-all hover:bg-[var(--brand-navy-hover)] hover:shadow-lg active:scale-[0.98]"
 >
 العودة للرئيسية
 </Link>
 <Link
 href="/contact"
 className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--brand-navy-border)] bg-card px-6 py-3 text-sm font-bold text-[var(--brand-navy)] hover:bg-[var(--brand-navy-soft)] transition-colors"
 >
 تواصل مع الدعم
 </Link>
 </div>
 </div>
 </div>
 <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
 <span className="flex items-center gap-2 text-xs font-extrabold tracking-wide text-[var(--brand-navy)]">
 <span className="h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
 أ. أحمد الدسوقي — الكيمياء
 </span>
 <span className="rounded-full bg-[var(--brand-teal-soft)] px-2.5 py-1 text-xs font-bold text-emerald-700 border border-[var(--brand-teal-border)]">
 آمن وللعرض فقط
 </span>
 </div>
 </div>

 <p className="mt-4 text-center text-xs font-medium text-[var(--text-muted)]">
 اللينك ده للعرض فقط ومش بيسمح بالتعديل.
 </p>
 </div>
 </div>
 </div>
 </main>
 );
}
