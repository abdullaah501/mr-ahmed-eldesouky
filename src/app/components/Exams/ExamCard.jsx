"use client";

import { useRouter } from "next/navigation";
import Hashids from "hashids";
import { FiClock, FiArrowRight } from "react-icons/fi";
import { LuFlaskConical, LuCheck } from "react-icons/lu";

function encodeId(id) {
 const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
 return hashids.encodeHex(String(id));
}

export default function ExamCard({ exam }) {
 const router = useRouter();
 const label = exam?.title || "اختبار";
 const questionCount =
 exam?.questionItems?.length ||
 exam?.questions?.length ||
 exam?._questionCount ||
 0;
 const duration = exam?.durationMinutes || exam?.duration || 30;
 const rawDifficulty = exam?.difficulty || exam?.level || "متوسط";
 const difficultyMap = {
 "سهل": "سهل",
 "متوسط": "متوسط",
 "صعب": "صعب",
 "Easy": "سهل",
 "Medium": "متوسط",
 "Hard": "صعب",
 };
 const difficulty = difficultyMap[rawDifficulty] || rawDifficulty;
 const gradeName = exam?._gradeName || exam?.gradeName || "";
 const attempted = !!exam?.hasAttempted;

 const diffDot = {
 "سهل": "bg-emerald-500",
 "متوسط": "bg-[#FFB81C]",
 "صعب": "bg-red-500",
 }[difficulty];

 return (
 <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--brand-navy-border)]">
 {/* status ribbon */}
 <div
 className={`flex items-center justify-between px-4 py-1.5 text-[11px] font-extrabold ${
 attempted
 ? "bg-[var(--brand-amber-soft)] text-[#7A5200] "
 : "bg-[var(--brand-teal-soft)] text-[#0E7C7E] "
 }`}
 >
 <span>
 {attempted ? (
 <span className="inline-flex items-center gap-1">
 <LuCheck size={12} /> تم الحل — شوف نتيجتك
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5">
 <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
 اختبار جديد متاح
 </span>
 )}
 </span>
 <span className="font-bold opacity-80">{gradeName || "الكيمياء"}</span>
 </div>

 <div className="flex flex-1 gap-4 p-4 sm:p-5">
 {/* identity block */}
 <div className="flex shrink-0 flex-col items-center gap-1.5">
 <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-bl from-[#073B40] to-[#0B5155] text-white shadow-sm">
 <LuFlaskConical size={24} />
 </span>
 <span
 dir="ltr"
 className="text-xs font-black tabular-nums text-[var(--text-primary)]"
 >
 {questionCount}Q
 </span>
 </div>

 {/* content */}
 <div className="flex min-w-0 flex-1 flex-col">
 <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[var(--text-primary)] group-hover:text-[var(--brand-navy)] sm:text-base">
 {label}
 </h3>
 <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-muted)]">
 <div className="flex items-center gap-1.5">
 <dt className="sr-only">عدد الأسئلة</dt>
 <dd className="font-bold">
 {questionCount} {questionCount === 1 ? "سؤال" : "أسئلة"}
 </dd>
 </div>
 <div className="flex items-center gap-1.5">
 <FiClock size={12} aria-hidden />
 <dt className="sr-only">المدة</dt>
 <dd className="font-bold">{duration} دقيقة</dd>
 </div>
 <div className="flex items-center gap-1.5">
 <dt className="sr-only">الصعوبة</dt>
 <dd className="flex items-center gap-1.5 font-bold">
 <span
 aria-hidden
 className={`h-2 w-2 rounded-full ${diffDot || "bg-[var(--brand-teal)]"}`}
 />
 {difficulty}
 </dd>
 </div>
 </dl>

 <button
 type="button"
 onClick={() => router.push(`/exam/${encodeId(exam._id)}`)}
 className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--brand-amber)] bg-[var(--brand-amber)] px-4 py-2.5 text-sm font-bold text-[var(--brand-amber-ink)] shadow-sm transition-colors hover:bg-[var(--brand-amber-hover)] hover:border-[var(--brand-amber-hover)] active:scale-[0.98] sm:mt-auto sm:translate-y-0"
 >
 {attempted ? "شوف النتيجة" : "ابدأ الاختبار"}{" "}
 <FiArrowRight size={14} className="flip-rtl" />
 </button>
 </div>
 </div>
 </article>
 );
}
