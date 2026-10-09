"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import ExamCard from "../Exams/ExamCard";
import Spinner from "../ui/Spinner";
import { FiArrowLeft } from "react-icons/fi";
import { LuFlaskConical, LuCircleCheck } from "react-icons/lu";

export default function MyExamsSection() {
  const gradesQuery = useQuery({
    // Distinct key: MyGradesSection caches the full envelope under
    // ["myGrades"] — sharing the key here leaked an object where this
    // component expects the array (caused "a.map is not a function").
    queryKey: ["myGradesList"],
    queryFn: async () => {
      const { getMyGrades } = await import("@/app/actions/studentActions");
      const res = await getMyGrades();
      if (!res?.success) throw new Error(res?.message || "Failed to load grades");
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchOnWindowFocus: false,
  });

  const grades = gradesQuery.data || [];

  const examsQueries = useQuery({
    queryKey: ["myExams", grades.map((g) => g._id).join(",")],
    queryFn: async () => {
      const { getExams } = await import("@/app/actions/examActions");
      const results = await Promise.all(
        grades.map(async (g) => {
          const res = await getExams(g._id);
          if (!res?.success) return [];
          return (res.data || []).map((e) => ({
            ...e,
            _gradeName: g.name,
          }));
        })
      );
      return results.flat();
    },
    enabled: grades.length > 0,
    refetchOnWindowFocus: false,
  });

  if (gradesQuery.isLoading) return <Spinner text="جاري التحميل..." />;

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
          اختار صفك من الإعدادات عشان تظهرلك اختباراتك هنا.
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

  if (examsQueries.isLoading) return <Spinner text="جاري تحميل الاختبارات..." />;

  const exams = examsQueries.data || [];

  if (exams.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--brand-teal-soft)] text-2xl text-[var(--brand-teal)]">
          <LuCircleCheck size={26} />
        </span>
        <p className="mt-4 text-lg font-black text-text-primary">
          لا توجد اختبارات متاحة حالياً
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
          أول ما الأستاذ ينشر اختبار لصفك هيظهر هنا على طول.
        </p>
        <Link
          href="/userDashboard/overview"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-6 py-2.5 text-sm font-bold text-text-secondary transition-colors hover:border-[var(--brand-navy-border)] hover:text-[var(--brand-navy)]"
        >
          العودة للوحة
          <FiArrowLeft size={14} className="flip-rtl" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {exams.map((exam) => (
        <ExamCard key={exam._id} exam={exam} />
      ))}
    </div>
  );
}
