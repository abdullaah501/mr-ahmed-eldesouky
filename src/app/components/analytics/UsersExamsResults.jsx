"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
 FiChevronLeft,
 FiChevronRight,
 FiCheckCircle,
 FiXCircle,
 FiClock,
 FiUser,
 FiBook,
 FiFileText,
} from "react-icons/fi";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { api } from "../../../../lib/axios/axios";
import Spinner from "../ui/Spinner";
import ExamAttemptDetailsModal from "./ExamAttemptDetailsModal";

const UsersExamsResults = ({ filters = {} }) => {
 const { gradeId = "", examId = "", search = "" } = filters;
 const [page, setPage] = useState(1);
 const [activeAttempt, setActiveAttempt] = useState(null);
 const limit = 10;
 useEffect(() => {
 setPage(1);
 }, [gradeId, examId, search]);
 const { data, isLoading, isError, error } = useQuery({
 queryKey: ["usersExamsResults", page, filters],
 queryFn: async () => {
 const params = new URLSearchParams({
 page: String(page),
 limit: String(limit),
 });
 if (gradeId) params.set("gradeId", gradeId);
 if (examId) params.set("examId", examId);
 if (search) params.set("search", search);
 const res = await api.get(`/api/usersExamsResults?${params.toString()}`);
 const d = res.data;
 if (!d?.success) throw new Error("Failed to load data");
 return d;
 },
 keepPreviousData: true,
 });

 const formatDate = (s) =>
 format(new Date(s), "dd MMM yyyy - hh:mm a", { locale: enGB });

 const isAttemptClickable = (row) =>
 Boolean(row?.exam?._id && row?.student?._id);

 const openAttempt = (row) => {
 if (!isAttemptClickable(row)) return;
 setActiveAttempt({
 studentId: row.student._id,
 examId: row.exam._id,
 meta: {
 studentName: `${row.student?.firstName || ""} ${row.student?.lastName || ""}`.trim(),
 studentEmail: row.student?.email || "",
 examTitle: row.exam?.title || "",
 gradeName: row.gradeId?.name || "",
 score: row.score || null,
 createdAt: row.createdAt || null,
 isCompleted: row.isCompleted,
 },
 });
 };

 const handleAttemptKeyDown = (event, row) => {
 if (event.key !== "Enter" && event.key !== " ") return;
 event.preventDefault();
 openAttempt(row);
 };

 const getScoreColor = (score) => {
 if (score >= 80)
 return "text-emerald-700 bg-emerald-50 border border-emerald-200 ";
 if (score >= 60)
 return "text-amber-700 bg-amber-50 border border-amber-200 ";
 return "text-red-700 bg-red-50 border border-red-200 ";
 };

 if (isLoading)
 return (
 <div className="mt-8">
 <Spinner text="جاري تحميل النتايج..." />
 </div>
 );
 if (isError)
 return (
 <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center ">
 <div className="inline-flex items-center gap-2 text-red-700 font-bold">
 <FiXCircle /> حصل خطأ — {error.message}
 </div>
 </div>
 );

 const { data: examsResults, pagination } = data;

 return (
 <div className="mt-10">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="h-8 w-1 rounded-full bg-brand-navy" />
 <div>
 <h2 className="text-xl font-extrabold text-text-primary sm:text-2xl">
 نتايج الامتحانات
 </h2>
 <p className="text-xs font-semibold text-text-muted">
 كل إجابات الطلبة في مكان واحد
 </p>
 </div>
 </div>
 <div className="inline-flex items-center gap-3 self-start rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-4 py-2 sm:self-auto">
 <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-navy text-white">
 <FiFileText size={14} />
 </span>
 <div className="text-right">
 <p className="text-xs font-bold text-brand-navy">إجمالي النتايج</p>
 <p className="text-lg font-black text-brand-navy">
 {pagination.totalResults}
 </p>
 </div>
 </div>
 </div>

 <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border bg-brand-navy-soft">
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 الطالب
 </th>
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 الكورس
 </th>
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 المحاضرة
 </th>
 <th className="px-5 py-3 text-center text-xs font-extrabold tracking-wider text-brand-navy">
 الدرجة
 </th>
 <th className="px-5 py-3 text-center text-xs font-extrabold tracking-wider text-brand-navy">
 الحالة
 </th>
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 التاريخ
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {examsResults.length === 0 ? (
 <tr>
 <td colSpan={6} className="py-16 text-center">
 <div className="flex flex-col items-center gap-2 text-text-muted">
 <FiFileText className="text-4xl opacity-40" />
 <p className="text-sm font-bold">مفيش نتايج للعرض</p>
 </div>
 </td>
 </tr>
 ) : (
 examsResults.map((r) => {
 const correct = r.score?.correct || 0;
 const wrong = r.score?.wrong || 0;
 const total = correct + wrong;
 const pct = total ? Math.round((correct / total) * 100) : 0;
 return (
 <tr
 key={r._id}
 onClick={isAttemptClickable(r) ? () => openAttempt(r) : undefined}
 onKeyDown={
 isAttemptClickable(r)
 ? (event) => handleAttemptKeyDown(event, r)
 : undefined
 }
 role={isAttemptClickable(r) ? "button" : undefined}
 tabIndex={isAttemptClickable(r) ? 0 : undefined}
 className={`transition-colors hover:bg-brand-navy-soft/40 ${
 isAttemptClickable(r)
 ? "cursor-pointer focus:outline-none focus-visible:bg-brand-navy-soft/60"
 : ""
 }`}
 >
 <td className="px-5 py-4">
 <div className="flex items-center gap-3">
 <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiUser size={14} />
 </span>
 <div>
 <p className="text-sm font-bold text-text-primary">
 {r.student?.firstName} {r.student?.lastName}
 </p>
 <p className="text-xs text-text-muted">
 {r.student?.email}
 </p>
 </div>
 </div>
 </td>
 <td className="px-5 py-4 text-sm text-text-secondary">
 <span className="inline-flex items-center gap-1.5">
 <FiBook size={12} className="text-text-muted" />
 {r.courseId?.title || "—"}
 </span>
 </td>
 <td className="px-5 py-4 text-sm text-text-secondary">
 {r.lessonId?.title || "—"}
 </td>
 <td className="px-5 py-4 text-center">
 <span
 className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${getScoreColor(pct)}`}
 >
 {correct} ✔ / {wrong} ✖{" "}
 <span className="opacity-70">({pct}%)</span>
 </span>
 </td>
 <td className="px-5 py-4 text-center">
 {r.isCompleted ? (
 <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
 <FiCheckCircle size={12} />
 مكتمل
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-700">
 <FiClock size={12} />
 غير مكتمل
 </span>
 )}
 </td>
 <td className="px-5 py-4 text-xs font-medium text-text-muted whitespace-nowrap">
 {formatDate(r.createdAt)}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>

 <div className="mt-6 grid gap-3 md:hidden">
 {examsResults.length === 0 ? (
 <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm font-bold text-text-muted">
 مفيش نتايج
 </div>
 ) : (
 examsResults.map((r) => {
 const correct = r.score?.correct || 0;
 const wrong = r.score?.wrong || 0;
 const pct =
 correct + wrong
 ? Math.round((correct / (correct + wrong)) * 100)
 : 0;
 return (
 <div
 key={r._id}
 onClick={isAttemptClickable(r) ? () => openAttempt(r) : undefined}
 onKeyDown={
 isAttemptClickable(r)
 ? (event) => handleAttemptKeyDown(event, r)
 : undefined
 }
 role={isAttemptClickable(r) ? "button" : undefined}
 tabIndex={isAttemptClickable(r) ? 0 : undefined}
 className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${
 isAttemptClickable(r)
 ? "cursor-pointer focus:outline-none focus-visible:bg-brand-navy-soft/30"
 : ""
 }`}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-2.5">
 <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiUser size={14} />
 </span>
 <div>
 <p className="text-sm font-bold text-text-primary">
 {r.student?.firstName} {r.student?.lastName}
 </p>
 <p className="text-xs text-text-muted">
 {r.student?.email}
 </p>
 </div>
 </div>
 {r.isCompleted ? (
 <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-700">
 مكتمل
 </span>
 ) : (
 <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-bold text-amber-700">
 غير مكتمل
 </span>
 )}
 </div>
 <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-text-muted">
 <p className="flex items-center gap-1.5">
 <FiBook size={12} />
 {r.courseId?.title || "—"}
 </p>
 <p className="flex items-center gap-1.5">
 <FiFileText size={12} />
 {r.lessonId?.title || "—"}
 </p>
 </div>
 <div className="mt-3 flex items-center justify-between">
 <span
 className={`rounded-full px-3 py-1 text-xs font-black ${getScoreColor(pct)}`}
 >
 {correct} ✔ / {wrong} ✖ ({pct}%)
 </span>
 <span className="text-xs font-medium text-text-muted">
 {formatDate(r.createdAt)}
 </span>
 </div>
 </div>
 );
 })
 )}
 </div>

 {pagination.totalPages > 1 && (
 <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:flex-row">
 <p className="text-sm font-medium text-text-muted">
 عرض{" "}
 <span className="font-black text-text-primary">
 {(page - 1) * limit + 1}
 </span>{" "}
 لـ{" "}
 <span className="font-black text-text-primary">
 {Math.min(page * limit, pagination.totalResults)}
 </span>{" "}
 من{" "}
 <span className="font-black text-brand-navy">
 {pagination.totalResults}
 </span>
 </p>
 <div className="flex items-center gap-1">
 <button
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={page === 1}
 className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40"
 >
 <FiChevronRight />
 </button>
 <div className="flex items-center gap-1">
 {[...Array(pagination.totalPages)].map((_, idx) => {
 const n = idx + 1;
 const cur = n === page;
 const show =
 n === 1 ||
 n === pagination.totalPages ||
 (n >= page - 1 && n <= page + 1);
 if (!show && n === page - 2)
 return (
 <span key={n} className="px-1 text-text-muted">
 …
 </span>
 );
 if (!show && n === page + 2)
 return (
 <span key={n} className="px-1 text-text-muted">
 …
 </span>
 );
 if (!show) return null;
 return (
 <button
 key={n}
 onClick={() => setPage(n)}
 className={`h-9 min-w-9 rounded-xl px-3 text-sm font-bold ${cur ? "bg-brand-navy text-white shadow-sm" : "border border-border bg-card text-text-primary hover:bg-brand-navy-soft"}`}
 >
 {n}
 </button>
 );
 })}
 </div>
 <button
 onClick={() =>
 setPage((p) => Math.min(pagination.totalPages, p + 1))
 }
 disabled={page === pagination.totalPages}
 className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40"
 >
 <FiChevronLeft />
 </button>
 </div>
 </div>
 )}

 <ExamAttemptDetailsModal
 isOpen={!!activeAttempt}
 onClose={() => setActiveAttempt(null)}
 viewer="admin"
 studentId={activeAttempt?.studentId}
 examId={activeAttempt?.examId}
 meta={activeAttempt?.meta}
 />
 </div>
 );
};
export default UsersExamsResults;
