"use client";

import Link from "next/link";
import { LuSigma, LuDiamond, LuTriangle, LuArrowLeft } from "react-icons/lu";
import { useStudentAnalytics } from "../../../../hooks/useStudentAnalytics";

export default function UserAnalyticsSection() {
  const { data: response, isLoading, isError, refetch } = useStudentAnalytics();

  if (isLoading) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl border border-border bg-card p-6"
          />
        ))}
      </div>
    );
  }

  if (isError || !response?.success) {
    return (
      <div
        className="mt-6 rounded-2xl border border-red-200 bg-card p-8 text-center"
      >
        <p className="font-bold text-text-primary">مش قادر يحمل البيانات</p>
        <p className="mt-1 text-sm text-text-muted">
          اتأكد من الاتصال وحاول تاني.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-xl bg-brand-navy px-5 py-2 text-sm font-bold text-white"
        >
          حاول مرة أخرى
        </button>
      </div>
    );
  }

  const analytics = response?.data || {};
  const grades = analytics.grades || [];
  const gradeSummary = analytics.gradeSummary || {
    averageScore: 0,
    totalExamsTaken: 0,
    totalCorrect: 0,
    totalWrong: 0,
  };
  const attendance = analytics.attendance || {
    percentage: null,
    total: 0,
    attended: 0,
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Performance — teal accent */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-teal-soft text-brand-teal font-black border border-[var(--brand-teal-border)]">
              <LuSigma size={16} />
            </span>
            <h4 className="font-extrabold text-text-primary">
              ملخص الأداء
            </h4>
            <span className="mr-auto rounded-full bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy border border-(--brand-navy-border)">
              {gradeSummary.totalExamsTaken} امتحانات
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-[var(--brand-teal-border)] bg-brand-teal-soft">
              <span className="text-lg font-black text-emerald-700">
                {gradeSummary.averageScore}%
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted">
                نسبة الإجابات الصحيحة
              </p>
              <p className="text-xs text-text-muted">
                صح{" "}
                <span className="font-bold text-emerald-600">
                  {gradeSummary.totalCorrect}
                </span>{" "}
                · غلط{" "}
                <span className="font-bold text-red-600">
                  {gradeSummary.totalWrong}
                </span>
              </p>
            </div>
          </div>
          <Link
            href="/userDashboard/exams"
            className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm font-bold text-brand-navy hover:gap-1 transition-all"
          >
            <span>سجل الامتحانات</span>
            <LuArrowLeft size={14} />
          </Link>
        </div>

        {/* Attendance */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy font-black border border-(--brand-navy-border)">
              <LuDiamond size={16} />
            </span>
            <h4 className="font-extrabold text-text-primary">
              نسبة الحضور
            </h4>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl font-black ${attendance.percentage == null ? "text-text-muted" : attendance.percentage >= 75 ? "text-emerald-600" : attendance.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}
            >
              {attendance.percentage == null
                ? "—"
                : `${attendance.percentage}%`}
            </span>
            <span className="text-xs font-semibold text-text-muted">
              ({attendance.attended} of {attendance.total})
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div
              className={`h-full rounded-full ${attendance.percentage >= 75 ? "bg-brand-teal" : attendance.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${attendance.percentage ?? 0}%` }}
            />
          </div>
          <Link
            href="/userDashboard/grades"
            className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm font-bold text-brand-navy pt-4"
          >
            <span>صفوفي</span>
            <LuArrowLeft size={14} />
          </Link>
        </div>

        {/* Grades */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-navy text-white font-black">
              <LuTriangle size={16} />
            </span>
            <h4 className="font-extrabold text-text-primary">صفوفي</h4>
            <span className="mr-auto rounded-full bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy border border-(--brand-navy-border)">
              {grades.length}
            </span>
          </div>
          <div className="min-h-[72px] space-y-1.5">
            {grades.length === 0 ? (
              <p className="text-sm text-text-muted">
                لسه مفيش صفوف مفتوحة. استخدم كود الانضمام.
              </p>
            ) : (
              grades.slice(0, 5).map((g) => (
                <Link
                  key={String(g.gradeId)}
                  href={`/userDashboard/grades/${g.gradeId}`}
                  className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-brand-navy"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />{" "}
                  {g.gradeName}
                </Link>
              ))
            )}
            {grades.length > 5 && (
              <p className="text-xs font-semibold text-text-muted">
                +{grades.length - 5} أخرى
              </p>
            )}
          </div>
          <Link
            href="/userDashboard/grades"
            className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm font-bold text-brand-navy"
          >
            <span>إدارة صفوفي</span>
            <LuArrowLeft size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
