"use client";

import { useRouter } from "next/navigation";
import Hashids from "hashids";
import { FiClock } from "react-icons/fi";
import { LuArrowLeft } from "react-icons/lu";
import AtomOrbit from "../brand/AtomOrbit";

function encodeId(id) {
  const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
  return hashids.encodeHex(String(id));
}

/**
 * ExamShowcaseCard — homepage exam card: brand-art band + white body
 * (reference style). All content comes from real exam data.
 */
export default function ExamShowcaseCard({ exam, featured = false }) {
  const router = useRouter();
  const attempted = !!exam?.hasAttempted;
  const questionCount =
    exam?.questionItems?.length ||
    exam?.questions?.length ||
    exam?._questionCount ||
    0;
  const duration = exam?.durationMinutes || exam?.duration || null;

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
        featured ? "lg:-translate-y-3 lg:shadow-xl" : ""
      }`}
    >
      {/* art band */}
      <div className="relative h-24 overflow-hidden bg-gradient-to-bl from-[#073B40] to-[#0B5155]">
        <div
          aria-hidden
          className="chem-pattern pointer-events-none absolute inset-0 opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80"
        >
          <AtomOrbit size={78} variant="dark" animated={false} />
        </div>
        <span
          className={`absolute top-3 left-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ${
            attempted
              ? "bg-white/20 text-white"
              : "bg-[#159A9C] text-white"
          }`}
        >
          {attempted ? "مكتمل" : "متاح الآن"}
        </span>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-black leading-snug text-text-primary">
          {exam?.title || "اختبار"}
        </h3>
        <p className="mt-1 truncate text-xs font-bold text-text-muted">
          {exam?._gradeName || exam?.gradeName || "الكيمياء"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-text-muted">
          {questionCount > 0 ? (
            <span>
              {questionCount} {questionCount === 1 ? "سؤال" : "أسئلة"}
            </span>
          ) : null}
          {duration ? (
            <span className="inline-flex items-center gap-1">
              <FiClock size={12} aria-hidden />
              {duration} دقيقة
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => router.push(`/exam/${encodeId(exam._id)}`)}
          className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-black transition-all active:scale-[0.98] ${
            attempted
              ? "bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white"
              : featured
                ? "bg-[var(--brand-amber)] text-[var(--brand-amber-ink)] hover:bg-[var(--brand-amber-hover)]"
                : "border-2 border-[var(--brand-amber)] bg-transparent text-[var(--brand-navy)] hover:bg-[var(--brand-amber-soft)]"
          }`}
        >
          {attempted ? "عرض التفاصيل" : "ابدأ الامتحان"}
          <LuArrowLeft size={15} />
        </button>
      </div>
    </article>
  );
}