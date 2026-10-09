"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FiArrowLeft } from "react-icons/fi";
import { LuFlaskConical } from "react-icons/lu";

export default function MyGradesSection() {
  const gradesQuery = useQuery({
    queryKey: ["myGrades"],
    queryFn: async () => {
      const { getMyGrades } = await import("@/app/actions/studentActions");
      const res = await getMyGrades();
      if (!res?.success) throw new Error(res?.message || "Failed to load grades");
      return res;
    },
    refetchOnWindowFocus: false,
  });

  if (gradesQuery.isLoading)
    return (
      <p className="py-12 text-center text-sm text-text-muted">
        جاري التحميل...
      </p>
    );
  if (gradesQuery.isError)
    return (
      <p className="py-12 text-center text-sm font-semibold text-danger">
        {gradesQuery.error?.message || "حدث خطأ ما"}
      </p>
    );

  const grades = gradesQuery.data?.data || [];
  if (grades.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--brand-navy-soft)] text-2xl text-[var(--brand-navy)]">
          <LuFlaskConical size={26} />
        </span>
        <p className="mt-4 text-lg font-black text-text-primary">
          لا يوجد صف مسجل بعد
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
          اختار صفك من الإعدادات عشان يوصلك الشرح والاختبارات والمراجعات.
        </p>
        <Link
          href="/userDashboard/settings"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-amber)] bg-[var(--brand-amber)] px-6 py-2.5 text-sm font-black text-[var(--brand-amber-ink)] transition-colors hover:bg-[var(--brand-amber-hover)] hover:border-[var(--brand-amber-hover)]"
        >
          روح على الإعدادات
          <FiArrowLeft size={14} className="flip-rtl" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {grades.map((g) => (
        <Link
          key={g._id}
          href={`/userDashboard/grades/${g._id}`}
          className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-(--brand-navy-border) hover:shadow-md"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[var(--brand-amber)] to-[var(--brand-teal)]" />
          <div className="flex items-center gap-3 p-5 pb-0">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-bl from-[#073B40] to-[#0B5155] text-xl text-white">
              <LuFlaskConical size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black text-text-primary group-hover:text-brand-navy line-clamp-1">
                {g.name}
              </h2>
              <p className="text-[11px] font-bold text-text-muted">
                كيمياء • شرح واختبارات
              </p>
            </div>
          </div>
          <div className="m-5 mt-4 flex items-center justify-between rounded-xl bg-background px-4 py-2.5 text-xs font-bold text-text-secondary">
            <span>المحاضرات والاختبارات</span>
            <FiArrowLeft size={14} className="text-brand-navy flip-rtl transition-transform group-hover:-translate-x-0.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
