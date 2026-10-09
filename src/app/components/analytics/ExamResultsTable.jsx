"use client";

import React from "react";
import { format } from "date-fns";
import {
 FiCheckCircle,
 FiClock,
 FiChevronLeft,
 FiChevronRight,
 FiBook,
 FiFileText,
} from "react-icons/fi";

function handleScore(score) {
 const correct = score?.correct || 0;
 const wrong = score?.wrong || 0;
 const total = correct + wrong;
 const percentage = (correct / total) * 100;

 return `<span class="text-green-600 font-semibold">${correct}</span>/<span class="text-red-500 font-semibold">${total}</span> <br/> <span class="text-primary font-bold">${percentage.toFixed(2)}%</span>`;
}

function getScoreColor(score) {
 const correct = score?.correct || 0;
 const wrong = score?.wrong || 0;
 const total = correct + wrong;
 const pct = total ? Math.round((correct / total) * 100) : 0;
 if (pct >= 80)
 return "text-green-600 bg-green-50 ";
 if (pct >= 60)
 return "text-yellow-600 bg-yellow-50 ";
 return "text-red-600 bg-red-50 bg-red-50 ";
}

export default function ExamResultsTable({
 examResults = [],
 pagination = null,
 currentPage,
 onPageChange,
 onExamResultClick,
 title = "درجات الامتحانات",
}) {
 const clickable = typeof onExamResultClick === "function";

 const handleKeyDown = (event, examResult) => {
 if (!clickable) return;
 if (event.key === "Enter" || event.key === " ") {
 event.preventDefault();
 onExamResultClick(examResult);
 }
 };

 return (
 <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy-border)] bg-card shadow-sm">
 <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)]" />
 <div className="bg-[var(--brand-navy-soft)]/50 border-b border-[var(--brand-navy-border)] px-5 py-4 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="bg-[var(--brand-navy)] w-1 h-5 rounded-full" />
 <h4 className="font-extrabold text-[var(--text-primary)] text-sm tracking-tight">
 {title}
 </h4>
 </div>
 {pagination?.totalResults != null && (
 <span className="bg-card border border-[var(--brand-navy-border)] text-[var(--brand-navy)] px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">
 {pagination.totalResults} امتحانات
 </span>
 )}
 </div>

 {/* Desktop table */}
 <div className="hidden sm:block overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="bg-[var(--background)] border-b border-border">
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
 الكورس
 </th>
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
 الامتحان
 </th>
 <th className="px-4 py-3 text-center text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
 الدرجة
 </th>
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
 التاريخ
 </th>
 <th className="px-4 py-3 text-center text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
 الحالة
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {examResults.map((examResult, index) => (
 <tr
 key={index}
 onClick={
 clickable ? () => onExamResultClick(examResult) : undefined
 }
 onKeyDown={
 clickable
 ? (event) => handleKeyDown(event, examResult)
 : undefined
 }
 role={clickable ? "button" : undefined}
 tabIndex={clickable ? 0 : undefined}
 aria-label={
 clickable
 ? `عرض تفاصيل محاولة ${examResult.examTitle || "الامتحان"}`
 : undefined
 }
 className={`transition-colors hover:bg-[var(--brand-navy-soft)]/30 ${
 clickable
 ? "cursor-pointer focus:outline-none focus-visible:bg-[var(--brand-navy-soft)]/50"
 : ""
 }`}
 >
 <td className="px-4 py-3">
 <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs font-medium">
 <FiBook
 size={12}
 className="flex-shrink-0 text-[var(--brand-navy)]/40"
 />
 <span className="truncate max-w-[140px]">
 {examResult.gradeName || "—"}
 </span>
 </div>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs font-medium">
 <FiFileText
 size={12}
 className="flex-shrink-0 text-[var(--brand-navy)]/40"
 />
 <span className="truncate max-w-[140px]">
 {examResult.examTitle || "—"}
 </span>
 </div>
 </td>
 <td
 className={`px-4 py-3 text-center text-xs font-bold`}
 dangerouslySetInnerHTML={{
 __html: handleScore(examResult.score),
 }}
 />
 <td className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
 {format(new Date(examResult.createdAt), "yyyy-MM-dd HH:mm")}
 </td>
 <td className="px-4 py-3 text-center">
 {examResult.isمكتمل ? (
 <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-teal-border)] bg-[var(--brand-teal-soft)] px-2.5 py-1 text-xs font-bold text-emerald-700">
 <FiCheckCircle size={10} /> مكتمل
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
 <FiClock size={10} /> قيد التصحيح
 </span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Mobile cards */}
 <div className="sm:hidden divide-y divide-border">
 {examResults.map((examResult, index) => {
 const correct = examResult.score?.correct || 0;
 const wrong = examResult.score?.wrong || 0;
 const total = correct + wrong;
 const pct = total ? Math.round((correct / total) * 100) : 0;
 return (
 <div
 key={index}
 onClick={
 clickable ? () => onExamResultClick(examResult) : undefined
 }
 onKeyDown={
 clickable
 ? (event) => handleKeyDown(event, examResult)
 : undefined
 }
 role={clickable ? "button" : undefined}
 tabIndex={clickable ? 0 : undefined}
 aria-label={
 clickable
 ? `عرض تفاصيل محاولة ${examResult.examTitle || "الامتحان"}`
 : undefined
 }
 className={`p-4 space-y-2 bg-card ${
 clickable
 ? "cursor-pointer focus:outline-none focus-visible:bg-[var(--brand-navy-soft)]/30"
 : ""
 }`}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="space-y-1 flex-1 min-w-0">
 <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
 <FiBook size={11} className="text-[var(--brand-navy)]/50" />
 <span className="truncate">
 {examResult.gradeName || "—"}
 </span>
 </div>
 <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
 <FiFileText
 size={11}
 className="text-[var(--brand-navy)]/50"
 />
 <span className="truncate">
 {examResult.examTitle || "—"}
 </span>
 </div>
 </div>
 {examResult.isمكتمل ? (
 <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-teal-border)] bg-[var(--brand-teal-soft)] px-2.5 py-1 text-xs font-bold text-emerald-700 flex-shrink-0">
 <FiCheckCircle size={10} /> مكتمل
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 flex-shrink-0">
 <FiClock size={10} /> قيد التصحيح
 </span>
 )}
 </div>
 <div className="flex items-center justify-between pt-1">
 <span
 className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(examResult.score)} border-current/20`}
 >
 {correct} ✔ / {wrong} ✖ ({pct}%)
 </span>
 <span className="text-xs font-medium text-[var(--text-muted)]">
 {format(new Date(examResult.createdAt), "yyyy-MM-dd")}
 </span>
 </div>
 </div>
 );
 })}
 </div>

 {/* Pagination */}
 {pagination?.totalPages > 1 &&
 typeof currentPage === "number" &&
 typeof onPageChange === "function" && (
 <div className="px-5 py-4 bg-[var(--background)] border-t border-border flex justify-between items-center">
 <button
 onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
 disabled={currentPage === 1}
 className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-bold text-[var(--text-primary)] hover:border-[var(--brand-navy-border)] hover:bg-[var(--brand-navy-soft)] hover:text-[var(--brand-navy)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
 >
 <FiChevronRight size={14} />
 السابق
 </button>

 <span className="rounded-full border border-[var(--brand-navy-border)] bg-card px-3 py-1 text-xs font-black text-[var(--brand-navy)]">
 {currentPage} / {pagination.totalPages}
 </span>

 <button
 onClick={() =>
 onPageChange(
 currentPage < pagination.totalPages
 ? currentPage + 1
 : currentPage,
 )
 }
 disabled={currentPage === pagination.totalPages}
 className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-bold text-[var(--text-primary)] hover:border-[var(--brand-navy-border)] hover:bg-[var(--brand-navy-soft)] hover:text-[var(--brand-navy)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
 >
 التالي
 <FiChevronLeft size={14} />
 </button>
 </div>
 )}
 </div>
 );
}
