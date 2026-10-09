import Link from "next/link";
import { LuArrowLeft, LuClipboardList, LuEye, LuFlaskConical } from "react-icons/lu";
import AtomOrbit from "../brand/AtomOrbit";
import Reveal from "../ui/Reveal";
import MetricRing from "./MetricRing";

/**
 * MockDashboard — static preview of the student dashboard shown to guests.
 * Every number here is illustrative sample data (never a real user result);
 * all actions point to signup/login instead of real exams.
 */
const MOCK_STATS = [
 {
 value: 72,
 max: 100,
 center: "72%",
 tone: "amber",
 label: "نسبة النجاح",
 sub: "من 45 سؤال",
 },
 {
 value: 4,
 max: 5,
 center: "4/5",
 tone: "teal",
 label: "الاختبارات المكتملة",
 sub: "من أصل 5",
 },
 {
 value: 12,
 max: 12,
 center: "12",
 tone: "teal",
 label: "الاختبارات المتاحة",
 sub: "متبقّية ليك",
 },
];

const MOCK_RESULTS = [
 {
 title: "اختبار الأيونات (التفاعلية)",
 percent: 85,
 date: "8 يونيو 2025",
 },
 {
 title: "اختبار البورون والفلورين (النظرية)",
 percent: 72,
 date: "25 مايو 2025",
 },
 { title: "اختبار نهاية الفصل", percent: 60, date: "12 أبريل 2025" },
];

export default function MockDashboard() {
 return (
 <section
 aria-labelledby="mock-dashboard-heading"
 className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
 >
 <Reveal scroll>
 <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
 <div>
 <p className="text-xs font-extrabold text-[var(--brand-teal)]">
 لوحتك الدراسية
 </p>
 <h2
 id="mock-dashboard-heading"
 className="mt-1 text-2xl font-black text-[var(--text-primary)] sm:text-3xl"
 >
 شوف لوحتك قبل ما تسجّل
 </h2>
 <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--text-muted)]">
 كل طالب بيتابع مستواه ونتايجه وحضوره من مكان واحد — دي معاينة
 توضيحية للوحة هتظهرلك بعد التسجيل.
 </p>
 </div>
 <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-teal-border)] bg-[var(--brand-teal-soft)] px-3.5 py-1.5 text-[11px] font-black text-[#0B5155]">
 <LuEye size={13} /> معاينة تجريبية
 </span>
 </div>
 </Reveal>

 <Reveal scroll delay={0.05}>
 <div className="relative">
 <div className="grid gap-4 lg:grid-cols-2">
 {/* stats mock */}
 <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
 <h3 className="flex items-center justify-between gap-2 text-lg font-black text-text-primary">
 إيه إحصائياتك؟
 <LuClipboardList size={20} className="text-[var(--brand-teal)]" />
 </h3>
 <div className="mt-6 grid grid-cols-3 gap-2">
 {MOCK_STATS.map((s) => (
 <MetricRing key={s.label} {...s} dimmed />
 ))}
 </div>
 <p className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-teal-soft)] px-4 py-3 text-center text-xs font-black text-[#0B5155]">
 <AtomOrbit size={26} variant="light" animated={false} />
 كل خطوة بتقربك من هدفك.. استمر!
 </p>
 </div>

 {/* welcome + next exam mock */}
 <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
 <h3 className="text-lg font-black text-text-primary">
 مرحباً يا بطل! 👋
 </h3>
 <p className="mt-1 text-sm text-text-muted">
 استمر في رحلتك نحو التفوق في الكيمياء — عندك 3 اختبارات جديدة
 </p>

 <div className="relative mt-4 flex-1 overflow-hidden rounded-2xl bg-gradient-to-bl from-[#073B40] to-[#0B5155] p-5 text-white">
 <div
 aria-hidden
 className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
 />
 <AtomOrbit
 size={130}
 variant="dark"
 animated={false}
 className="absolute -bottom-6 -left-4 opacity-70"
 />
 <div className="relative">
 <p className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB81C] px-3 py-1 text-[11px] font-black text-[#3D2C00]">
 <LuClipboardList size={12} /> الامتحان القادم
 </p>
 <h4 className="mt-3 line-clamp-2 text-lg font-black leading-snug">
 اختبار الباب الأول — الوحدة الأولى
 </h4>
 <p className="mt-1 text-xs font-bold text-white/60">
 الصف الثالث الثانوي • 20 سؤال • 90 دقيقة
 </p>
 <Link
 href="/signup"
 className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FFB81C] px-6 py-2.5 text-sm font-black text-[#3D2C00] transition-colors hover:bg-[#E9A400]"
 >
 سجّل وابدأ
 <LuArrowLeft size={15} />
 </Link>
 </div>
 </div>
 </div>
 </div>

 {/* results mock */}
 <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
 <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
 <h3 className="flex items-center gap-2 text-lg font-black text-text-primary">
 آخر نتائجك
 <LuClipboardList size={19} className="text-[var(--brand-teal)]" />
 </h3>
 <span className="text-[11px] font-bold text-text-muted">
 بيانات توضيحية
 </span>
 </div>
 <div className="overflow-x-auto p-3 sm:p-4">
 <table className="w-full min-w-[480px] text-sm">
 <thead>
 <tr className="border-b border-border text-right text-[11px] font-black text-text-muted">
 <th className="px-3 py-2.5 font-black">الامتحان</th>
 <th className="px-3 py-2.5 font-black">التاريخ</th>
 <th className="px-3 py-2.5 font-black">الدرجة</th>
 <th className="px-3 py-2.5 font-black">الحالة</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border)] opacity-80">
 {MOCK_RESULTS.map((r) => (
 <tr key={r.title} className="text-right">
 <td className="max-w-[240px] truncate px-3 py-3 font-bold text-text-primary">
 {r.title}
 </td>
 <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-text-muted">
 {r.date}
 </td>
 <td className="px-3 py-3">
 <span
 dir="ltr"
 className="font-black tabular-nums text-[#7A5200] "
 >
 {r.percent}%
 </span>
 </td>
 <td className="px-3 py-3">
 <span className="rounded-full bg-[var(--brand-teal-soft)] px-2.5 py-1 text-[11px] font-black text-[#0E7C7E] ">
 ناجح
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* CTA overlay */}
 <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
 <div className="pointer-events-auto -translate-y-1/2">
 <Link
 href="/signup"
 className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB81C] px-7 py-3.5 text-sm font-black text-[#3D2C00] shadow-xl transition-all hover:bg-[#E9A400] active:scale-[0.98]"
 >
 <LuFlaskConical size={17} />
 سجّل مجاناً وشوف لوحتك الحقيقية
 </Link>
 </div>
 </div>
 <div className="h-8" aria-hidden />
 </div>
 </Reveal>
 </section>
 );
}