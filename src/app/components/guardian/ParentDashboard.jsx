"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import {
 FiBook,
 FiCalendar,
 FiUserCheck,
 FiEye,
 FiShield,
 FiTrendingUp,
 FiAward,
} from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";
import { LuSigma, LuCheck } from "react-icons/lu";
import { format } from "date-fns";
import ExamResultsTable from "../analytics/ExamResultsTable";
import ExamAttemptDetailsModal from "../analytics/ExamAttemptDetailsModal";
import { api } from "../../../../lib/axios/axios";

const ATTENDANCE_LABELS = {
 present: "حاضر",
 late: "متأخر",
 absent: "غائب",
};

const ATTENDANCE_STYLES = {
 present:
 "text-emerald-700 bg-[var(--brand-teal-soft)] border border-[var(--brand-teal-border)]",
 late: "text-amber-700 bg-amber-50 border border-amber-200 ",
 absent:
 "text-red-700 bg-red-50 border border-red-200 ",
};

function AttendanceSummary({ attendance }) {
 if (!attendance || (attendance.total ?? 0) === 0) {
 return (
 <div className="rounded-2xl border border-dashed border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)]/50 px-6 py-10 text-center">
 <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-card border border-border shadow-sm mb-3">
 <FiCalendar size={20} className="text-[var(--brand-navy)]" />
 </div>
 <p className="text-sm font-bold text-[var(--text-primary)]">
 لسه مفيش سجلات حضور
 </p>
 <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
 الحضور هيظهر هنا أول ما الطالب يحضر الحصص.
 </p>
 </div>
 );
 }

 const pct = attendance.percentage;

 return (
 <div className="space-y-4">
 {/* rate pill */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <span className="inline-flex items-center gap-2 text-sm font-extrabold tracking-wide text-[var(--brand-navy)]">
 <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-navy-soft)] border border-[var(--brand-navy-border)] text-[var(--brand-navy)]">
 <FiUserCheck size={16} />
 </span>
 نسبة الحضور
 </span>
 <span
 className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-black ${
 pct == null
 ? "bg-[var(--brand-navy-soft)] border-[var(--brand-navy-border)] text-[var(--text-muted)]"
 : pct >= 75
 ? "bg-[var(--brand-teal-soft)] border-[var(--brand-teal-border)] text-emerald-700"
 : pct >= 50
 ? "bg-amber-50 border-amber-200 text-amber-700"
 : "bg-red-50 border-red-200 text-red-700"
 }`}
 >
 <FiTrendingUp size={14} />
 {pct == null ? "—" : `${pct}%`}
 </span>
 </div>

 {/* progress track */}
 {pct != null && (
 <div className="space-y-2">
 <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--background)] border border-border">
 <div
 className="h-full rounded-full transition-all duration-500"
 style={{
 width: `${Math.min(100, Math.max(0, pct))}%`,
 background:
 pct >= 75
 ? "var(--brand-teal)"
 : pct >= 50
 ? "#f59e0b"
 : "#ef4444",
 }}
 />
 </div>
 <div className="flex justify-between text-[11px] font-bold tracking-wide text-[var(--text-muted)]">
 <span>0%</span>
 <span>50%</span>
 <span>100%</span>
 </div>
 </div>
 )}

 <div className="space-y-2 max-h-64 overflow-y-auto pr-1 -mr-1 scrollbar-thin">
 {attendance.sessions.map((s, i) => (
 <div
 key={i}
 className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[var(--background)] px-3 py-2.5 transition-colors hover:border-[var(--brand-navy-border)] hover:bg-card"
 >
 <div className="min-w-0 flex items-center gap-2.5">
 <span className="grid h-7 w-7 place-items-center rounded-lg bg-card border border-border text-[var(--brand-navy)] shrink-0">
 <FiBook size={12} />
 </span>
 <div className="min-w-0">
 <p className="truncate text-xs font-bold text-[var(--text-primary)]">
 {s.gradeName}
 </p>
 <p className="text-[11px] font-medium text-[var(--text-muted)]">
 {format(new Date(s.date), "yyyy-MM-dd")}
 </p>
 </div>
 </div>
 <span
 className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${ATTENDANCE_STYLES[s.status]}`}
 >
 {ATTENDANCE_LABELS[s.status]}
 </span>
 </div>
 ))}
 </div>
 </div>
 );
}

function StudentHeader({ student }) {
 const fullName =
 `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
 const imageCloudId = student.image?.cloudId;

 return (
 <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy-border)] bg-card shadow-sm">
 {/* subtle grid + orbs */}
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0 opacity-[0.035]"
 style={{
 backgroundImage:
 "linear-gradient(var(--brand-navy) 1px, transparent 1px), linear-gradient(90deg, var(--brand-navy) 1px, transparent 1px)",
 backgroundSize: "22px 22px",
 }}
 />
 <div
 aria-hidden
 className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[var(--brand-navy-soft)] blur-2xl"
 />
 <div
 aria-hidden
 className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[var(--brand-teal-soft)] blur-2xl"
 />
 <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)]" />
 <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-7">
 <div className="relative shrink-0">
 {imageCloudId ? (
 <Image
 src={`/api/upload/proxyImage/${encodeURIComponent(imageCloudId)}`}
 alt={fullName || "طالب"}
 width={72}
 height={72}
 className="h-[72px] w-[72px] rounded-2xl object-cover border-2 border-white shadow-md"
 />
 ) : (
 <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-[var(--brand-navy-soft)] border border-[var(--brand-navy-border)] shadow-sm">
 <span className="text-2xl font-black text-[var(--brand-navy)]">
 {student.firstName?.charAt(0) || "?"}
 </span>
 </div>
 )}
 <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-teal)] border-2 border-white text-white shadow">
 <FiUserCheck size={12} />
 </span>
 </div>

 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)] px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-[var(--brand-navy)]">
 <FiBook size={11} />
 طالب
 </span>
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-teal-soft)] px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-[var(--brand-teal-border)]">
 أ. أحمد الدسوقي — الكيمياء
 </span>
 </div>
 <h2 className="mt-2 truncate text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">
 {fullName || "—"}
 </h2>
 <div className="mt-2 flex flex-wrap items-center gap-2">
 {student.grade && (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-navy)] px-3 py-1 text-xs font-extrabold text-white shadow-sm">
 <FiAward size={12} />
 {student.grade}
 </span>
 )}
 <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--background)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
 <FiShield size={12} className="text-[var(--brand-teal)]" />
 لينك عائلي خاص
 </span>
 </div>
 </div>

 <div className="hidden sm:flex flex-col items-end gap-2">
 <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-[var(--background)] px-3 py-2 text-xs font-bold text-[var(--text-muted)]">
 <FiEye size={13} className="text-[var(--brand-navy)]" />
 للعرض فقط
 </span>
 </div>
 </div>
 </div>
 );
}

export default function ParentDashboard({
 student,
 examResults,
 examResultsPagination,
 attendance,
 guardianToken,
}) {
 const [page, setPage] = useState(1);
 const [extraPage, setExtraPage] = useState(null);
 const [extraLoading, setExtraLoading] = useState(false);
 const [activeAttempt, setActiveAttempt] = useState(null);
 const limit = examResultsPagination?.limit ?? 5;

 const handlePageChange = async (nextPage) => {
 if (nextPage === page) return;
 setPage(nextPage);
 if (nextPage === 1) {
 setExtraPage(null);
 return;
 }
 setExtraLoading(true);
 try {
 const res = await api.get("/api/guardian/verify", {
 params: { token: guardianToken, page: nextPage, limit },
 });
 if (!res?.data?.success) {
 throw new Error(res?.data?.message || "فشل تحميل الصفحة");
 }
 setExtraPage(res.data.data);
 } catch (err) {
 toast.error(err?.message || "فشل تحميل الصفحة");
 setPage(page);
 } finally {
 setExtraLoading(false);
 }
 };

 const currentAttendance = extraPage ? extraPage.attendance : attendance;
 const currentExam = extraPage ? extraPage.examResults : examResults;
 const currentPagination = extraPage
 ? extraPage.examResultsPagination
 : examResultsPagination;

 const handleExamResultClick = (result) => {
 if (!result?.examId) return;
 setActiveAttempt({
 examId: result.examId,
 meta: {
 studentName:
 `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
 examTitle: result.examTitle || "",
 gradeName: result.gradeName || "",
 score: result.score || null,
 createdAt: result.createdAt || null,
 isCompleted: result.isCompleted,
 },
 });
 };

 const totalExams =
 currentPagination?.totalResults ?? examResults?.length ?? 0;
 const sessionsCount = currentAttendance?.total ?? 0;

 return (
 <main
 className="min-h-screen bg-[var(--background)] font-amin text-[var(--text-primary)]"
 >
 {/* Page backdrop — same as HeroSection / Contact */}
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
 className="absolute left-[6%] top-[14%] select-none text-7xl font-black text-[var(--brand-navy)] opacity-[0.04]"
 aria-hidden
 >
 <LuSigma size={72} />
 </span>
 <span
 className="absolute right-[8%] top-[28%] select-none text-6xl font-black text-[var(--brand-teal)] opacity-[0.06]"
 aria-hidden
 >
 π
 </span>
 <span
 className="absolute bottom-[16%] right-[18%] select-none text-5xl font-black text-[var(--brand-navy)] opacity-[0.05]"
 aria-hidden
 >
 <LuCheck size={48} />
 </span>
 </div>

 <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
 {/* Brand mini-bar */}
 <div className="mb-6 flex items-center justify-between gap-3">
 <Link
 href="/"
 className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy-border)] bg-card px-2.5 py-1.5 pr-3 shadow-sm transition-shadow hover:shadow-md"
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
 <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-navy)] px-3 py-1.5 text-xs font-bold text-white shadow-sm">
 <FiShield size={12} />
 عرض خاص لولي الأمر
 </span>
 </div>

 {/* Hero header — same language as Contact header */}
 <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy-border)] bg-card shadow-sm">
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0 opacity-[0.04]"
 style={{
 backgroundImage:
 "linear-gradient(var(--brand-navy) 1px, transparent 1px), linear-gradient(90deg, var(--brand-navy) 1px, transparent 1px)",
 backgroundSize: "24px 24px",
 }}
 />
 <div
 aria-hidden
 className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[var(--brand-navy-soft)] blur-2xl"
 />
 <div
 aria-hidden
 className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[var(--brand-teal-soft)] blur-2xl"
 />
 <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)]" />
 <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
 <div className="flex gap-4">
 <span className="hidden sm:grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-navy)] text-white shadow-sm shrink-0">
 <FiEye size={20} />
 </span>
 <div>
 <p
 className="text-xs font-extrabold tracking-[0.14em] text-[var(--brand-teal)]"
 style={{ fontFamily: "var(--font-poppins), system-ui" }}
 >
 متابعة ولي الأمر — للعرض فقط
 </p>
 <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
 مستوى ابنك الدراسي
 </h1>
 <p className="mt-1 text-sm font-semibold text-[var(--brand-navy)]">
 تابع الامتحانات والدرجات والحضور لحظة بلحظة.
 </p>
 <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">
 اللينك ده خاص وللعرض فقط. مش محتاج تسجيل دخول. الدرجات
 بتتحدث تلقائي بعد كل امتحان.
 </p>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
 <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-navy)]">
 <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-teal)] animate-pulse" />
 مباشر
 </span>
 <span className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]">
 <FiCalendar size={12} />
 محدّث النهاردة
 </span>
 </div>
 </div>
 </div>

 {/* Student */}
 <div className="mt-6">
 <StudentHeader student={student} />
 </div>

 {/* Quick stats */}
 <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
 <div className="rounded-2xl border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)]/60 p-4 flex items-center gap-3">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-navy)] text-white shadow-sm">
 <FiAward size={16} />
 </span>
 <div>
 <p className="text-[11px] font-extrabold tracking-wide text-[var(--brand-navy)]">
 الامتحانات
 </p>
 <p className="text-lg font-black leading-none text-[var(--text-primary)]">
 {totalExams}
 </p>
 </div>
 </div>
 <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 shadow-sm">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-teal-soft)] border border-[var(--brand-teal-border)] text-emerald-700">
 <FiUserCheck size={16} />
 </span>
 <div>
 <p className="text-[11px] font-extrabold tracking-wide text-[var(--text-muted)]">
 الحضور
 </p>
 <p className="text-lg font-black leading-none text-[var(--text-primary)]">
 {currentAttendance?.percentage != null
 ? `${currentAttendance.percentage}%`
 : "—"}
 </p>
 </div>
 </div>
 <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border bg-card p-4 flex items-center gap-3 shadow-sm">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--background)] border border-border text-[var(--brand-navy)]">
 <FiBook size={16} />
 </span>
 <div>
 <p className="text-[11px] font-extrabold tracking-wide text-[var(--text-muted)]">
 الحصص
 </p>
 <p className="text-lg font-black leading-none text-[var(--text-primary)]">
 {sessionsCount}
 </p>
 </div>
 </div>
 </div>

 {/* Exam results */}
 <section className="mt-6">
 {extraLoading ? (
 <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy-border)] bg-card shadow-sm">
 <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)]" />
 <div className="p-10 text-center">
 <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-navy-border)] border-t-[var(--brand-navy)] mb-3" />
 <p className="text-sm font-bold text-[var(--text-muted)]">
 جاري تحميل الامتحانات...
 </p>
 </div>
 </div>
 ) : (
 <ExamResultsTable
 examResults={currentExam}
 pagination={currentPagination}
 currentPage={page}
 onPageChange={handlePageChange}
 onExamResultClick={handleExamResultClick}
 />
 )}
 </section>

 {/* Attendance */}
 <section className="mt-6 relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
 <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)] opacity-60" />
 <div className="border-b border-border bg-[var(--brand-navy-soft)]/40 px-5 sm:px-6 py-4 flex items-center justify-between">
 <h3 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
 <span className="h-5 w-1 rounded-full bg-[var(--brand-navy)]" />
 تفاصيل الحضور
 </h3>
 <span className="rounded-full border border-[var(--brand-navy-border)] bg-card px-2.5 py-1 text-xs font-bold text-[var(--brand-navy)]">
 {sessionsCount} حصص
 </span>
 </div>
 <div className="p-5 sm:p-6">
 <AttendanceSummary attendance={currentAttendance} />
 </div>
 </section>

 <ExamAttemptDetailsModal
 isOpen={!!activeAttempt}
 onClose={() => setActiveAttempt(null)}
 viewer="guardian"
 guardianToken={guardianToken}
 examId={activeAttempt?.examId}
 meta={activeAttempt?.meta}
 />

 <p className="mt-6 text-center text-xs font-medium leading-relaxed text-[var(--text-muted)]">
 أ. أحمد الدسوقي — الكيمياء • للعرض فقط وآمنة • هذه الصفحة
 </p>
 </div>
 </main>
 );
}
