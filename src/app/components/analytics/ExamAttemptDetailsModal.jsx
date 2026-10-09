"use client";

import React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Hashids from "hashids";
import {
 FiAlertTriangle,
 FiAward,
 FiBook,
 FiCheckCircle,
 FiClock,
 FiFileText,
 FiUser,
} from "react-icons/fi";
import Modal from "../modal/Modal";
import Spinner from "../ui/Spinner";
import { api } from "../../../../lib/axios/axios";
import { getExam } from "../../actions/examActions";
import { get } from "@/question-system/plugins/registry";
import "@/question-system/plugins/multiple-choice/index";
import "@/question-system/plugins/true-false/index";
import "@/question-system/plugins/essay/index";
import "@/question-system/plugins/fill-blank/index";
import "@/question-system/plugins/matching/index";
import "@/question-system/plugins/image-choice/index";

function encodeExamId(id) {
 const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
 return hashids.encodeHex(String(id));
}

function formatDate(value) {
 if (!value) return "—";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "—";
 return format(date, "yyyy-MM-dd HH:mm");
}

function getScoreClasses(percentage) {
 if (percentage >= 80)
 return "text-emerald-700 bg-emerald-50 border-emerald-200 ";
 if (percentage >= 60)
 return "text-amber-700 bg-amber-50 border-amber-200 ";
 return "text-red-700 bg-red-50 border-red-200 ";
}

export function joinAnswered(question, submission) {
 const answers = Array.isArray(submission?.questionsAnswered)
 ? submission.questionsAnswered
 : [];
 return (
 answers.find(
 (entry) => String(entry?.questionId) === String(question?._id),
 ) || null
 );
}

async function fetchAdminAttempt({ studentId, examId }) {
 const [submissionResult, examResult] = await Promise.allSettled([
 api.get(
 `/api/getSubmission?studentId=${encodeURIComponent(studentId)}&examId=${encodeURIComponent(examId)}`,
 ),
 getExam(encodeExamId(examId)),
 ]);

 let submission = null;
 if (submissionResult.status === "fulfilled") {
 const payload = submissionResult.value?.data;
 if (!payload?.success) {
 throw new Error(payload?.message || "Failed to load submission");
 }
 submission = payload.data || null;
 } else if (submissionResult.reason?.response?.status !== 404) {
 throw submissionResult.reason;
 }

 let exam = null;
 if (examResult.status === "fulfilled") {
 const payload = examResult.value;
 if (payload?.success && payload.exam) {
 exam = payload.exam;
 } else if (payload?.message === "Exam not found") {
 exam = null;
 } else {
 throw new Error(payload?.message || "Failed to load exam");
 }
 } else {
 throw examResult.reason;
 }

 if (!submission) {
 return {
 notFound: true,
 message: "مفيش محاولة مسجلة للامتحان ده",
 submission: null,
 exam,
 };
 }

 return { notFound: false, submission, exam };
}

async function fetchGuardianAttempt({ guardianToken, examId }) {
 try {
 const response = await api.get("/api/guardian/attempt", {
 params: { examId },
 headers: { "x-guardian-token": guardianToken },
 });
 const payload = response?.data;
 if (!payload?.success) {
 throw new Error(payload?.message || "Failed to load attempt");
 }
 return {
 notFound: false,
 submission: payload.data?.submission || null,
 exam: payload.data?.exam || null,
 };
 } catch (error) {
 if (error?.response?.status === 404) {
 return {
 notFound: true,
 message:
 error?.response?.data?.message || "مفيش محاولة مسجلة للامتحان ده",
 submission: null,
 exam: null,
 };
 }
 throw error;
 }
}

export default function ExamAttemptDetailsModal({
 isOpen = false,
 onClose,
 viewer = "admin",
 studentId,
 examId,
 meta,
 guardianToken,
}) {
 const isAdmin = viewer === "admin";
 const hasRequiredIds = isAdmin
 ? Boolean(studentId) && Boolean(examId)
 : Boolean(guardianToken) && Boolean(examId);

 const query = useQuery({
 queryKey: isAdmin
 ? ["exam-attempt", "admin", String(studentId), String(examId)]
 : [
 "exam-attempt",
 "guardian",
 `guardian:${String(guardianToken).slice(-8)}`,
 String(examId),
 ],
 queryFn: () =>
 isAdmin
 ? fetchAdminAttempt({ studentId, examId })
 : fetchGuardianAttempt({ guardianToken, examId }),
 enabled: isOpen && hasRequiredIds,
 staleTime: 30_000,
 gcTime: 5 * 60_000,
 refetchOnWindowFocus: false,
 refetchOnReconnect: false,
 retry: (failureCount, error) => {
 const status = error?.response?.status;
 if (status >= 400 && status < 500) return false;
 return failureCount < 2;
 },
 });

 const data = query.data;
 const submission = data?.submission || null;
 const exam = data?.exam || null;
 const questions = Array.isArray(exam?.questions) ? exam.questions : [];
 const answeredList = Array.isArray(submission?.questionsAnswered)
 ? submission.questionsAnswered
 : [];

 const correct = submission?.score?.correct ?? meta?.score?.correct ?? 0;
 const wrong = submission?.score?.wrong ?? meta?.score?.wrong ?? 0;
 const total = correct + wrong;
 const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
 const isCompleted =
 submission?.isCompleted ?? Boolean(meta?.isCompleted);
 const questionCount = exam ? questions.length : answeredList.length;
 const studentName = meta?.studentName || "طالب";
 const examTitle = exam?.title || meta?.examTitle || "امتحان";

 let content = null;

 if (!hasRequiredIds) {
 content = (
 <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background px-6 py-14 text-center">
 <FiAlertTriangle size={26} className="text-amber-500" />
 <p className="text-sm font-bold text-text-primary">
 بيانات المحاولة ناقصة
 </p>
 <p className="text-xs text-text-muted">
 النتيجة المختارة ناقصة البيانات اللازمة لتحميل تفاصيلها.
 </p>
 </div>
 );
 } else if (query.isLoading) {
 content = <Spinner text="جاري تحميل تفاصيل المحاولة..." />;
 } else if (query.isError) {
 content = (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center ">
 <div className="inline-flex items-center gap-2 font-bold text-red-700 ">
 <FiAlertTriangle size={16} />
 {query.error?.message || "فشل تحميل تفاصيل المحاولة"}
 </div>
 <div className="mt-4">
 <button
 type="button"
 onClick={() => query.refetch()}
 className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover)"
 >
 إعادة المحاولة
 </button>
 </div>
 </div>
 );
 } else if (data?.notFound) {
 content = (
 <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background px-6 py-14 text-center">
 <FiFileText size={26} className="text-text-muted opacity-60" />
 <p className="text-sm font-bold text-text-primary">
 {data.message || "مفيش محاولة مسجلة للامتحان ده"}
 </p>
 <p className="text-xs text-text-muted">
 النتيجة ممكن تكون اتمسحت أو غير متاحة للينك ده.
 </p>
 </div>
 );
 } else if (data) {
 content = (
 <div className="space-y-5">
 <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
 <div className="flex flex-col gap-4 border-b border-border bg-[var(--brand-navy-soft)]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiUser size={16} />
 </span>
 <div className="min-w-0">
 <p className="truncate text-sm font-extrabold text-text-primary">
 {studentName}
 </p>
 {isAdmin && meta?.studentEmail ? (
 <p className="truncate text-xs text-text-muted">
 {meta.studentEmail}
 </p>
 ) : null}
 </div>
 </div>
 {isCompleted ? (
 <span className="inline-flex items-center gap-1 self-start rounded-full border border-[var(--brand-teal-border)] bg-[var(--brand-teal-soft)] px-2.5 py-1 text-xs font-bold text-emerald-700 sm:self-auto">
 <FiCheckCircle size={12} /> مكتمل
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 self-start rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 sm:self-auto">
 <FiClock size={12} /> بانتظار التصحيح
 </span>
 )}
 </div>

 <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
 <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-text-secondary">
 <FiFileText size={13} className="text-brand-navy/60" />
 <span className="truncate">{examTitle}</span>
 </div>
 <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-text-secondary">
 <FiAward size={13} className="text-brand-navy/60" />
 <span className="truncate">{meta?.gradeName || "—"}</span>
 </div>
 <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-text-secondary">
 <FiClock size={13} className="text-brand-navy/60" />
 <span className="truncate">
 {formatDate(submission?.createdAt || meta?.createdAt)}
 </span>
 </div>
 <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-text-secondary">
 <FiBook size={13} className="text-brand-navy/60" />
 <span className="truncate">
 {questionCount} {questionCount === 1 ? "سؤال" : "أسئلة"}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-3 border-t border-border p-4">
 <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center ">
 <p className="text-lg font-black text-emerald-700 ">
 {correct}
 </p>
 <p className="text-[11px] font-bold text-emerald-700/70 ">
 صح
 </p>
 </div>
 <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center ">
 <p className="text-lg font-black text-red-700 ">
 {wrong}
 </p>
 <p className="text-[11px] font-bold text-red-700/70 ">
 غلط
 </p>
 </div>
 <div
 className={`rounded-xl border px-3 py-2 text-center ${getScoreClasses(percentage)}`}
 >
 <p className="text-lg font-black">{percentage}%</p>
 <p className="text-[11px] font-bold opacity-70">النسبة</p>
 </div>
 </div>
 </div>
 {!exam && (
 <>
 <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-800 ">
 <FiAlertTriangle size={14} className="mt-0.5 shrink-0" />
 الامتحان ده مبقاش متاح. بنعرض الإجابات المسجلة فقط.
 </div>
 {answeredList.length === 0 ? (
 <div className="rounded-2xl border border-dashed border-border bg-background py-10 text-center text-sm font-bold text-text-muted">
 مفيش إجابات مسجلة للمحاولة دي
 </div>
 ) : (
 <div className="space-y-2">
 {answeredList.map((entry, index) => (
 <div
 key={`${entry?.questionId || "answer"}-${index}`}
 className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
 >
 <div className="min-w-0">
 <p className="text-xs font-bold text-text-primary">
 إجابة {index + 1}
 </p>
 <p className="mt-0.5 break-words text-xs text-text-secondary">
 {entry?.answer || "—"}
 </p>
 </div>
 <span
 className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
 entry?.isCorrect
 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
 : "border-red-200 bg-red-50 text-red-700"
 }`}
 >
 {entry?.isCorrect ? "صح" : "غلط"}
 </span>
 </div>
 ))}
 </div>
 )}
 </>
 )}

 {exam && questions.length === 0 && (
 <div className="rounded-2xl border border-dashed border-border bg-background py-10 text-center text-sm font-bold text-text-muted">
 مفيش أسئلة متاحة للامتحان ده
 </div>
 )}

 {exam && questions.length > 0 && (
 <div className="space-y-3">
 {questions.map((question, index) => {
 const answered = joinAnswered(question, submission);
 const plugin = get(question.type);
 const Renderer = plugin?.Renderer;
 return (
 <div
 key={question._id || index}
 className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
 >
 <div className="flex gap-3 border-b border-border bg-background px-4 py-3">
 <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-navy text-xs font-black text-white">
 {index + 1}
 </span>
 <p className="flex-1 pt-0.5 text-sm font-bold leading-relaxed text-text-primary">
 {question.questionText}
 </p>
 {answered ? (
 <span
 className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
 answered.isCorrect
 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
 : "border-red-200 bg-red-50 text-red-700"
 }`}
 >
 {answered.isCorrect ? (
 <FiCheckCircle size={13} />
 ) : (
 <FiAlertTriangle size={13} />
 )}
 </span>
 ) : (
 <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
 <FiClock size={11} /> لسه متجاوبش
 </span>
 )}
 </div>

 {question?.image?.cloudId && (
 <div className="border-b border-border bg-background/50 p-4">
 <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-border bg-card">
 <Image
 src={`/api/upload/proxyImage/${encodeURIComponent(question.image.cloudId)}`}
 alt={question.questionText || "صورة السؤال"}
 width={500}
 height={500}
 className="max-h-72 w-full object-contain"
 />
 </div>
 </div>
 )}

 <div className="p-4">
 {Renderer ? (
 <Renderer
 question={{ ...question, isCorrect: answered?.isCorrect }}
 register={null}
 isSubmitted={true}
 userAnswer={answered?.answer}
 mode="review"
 />
 ) : (
 <p className="rounded-xl border border-dashed border-border bg-background px-3 py-4 text-center text-xs font-bold text-text-muted">
 نوع سؤال غير مدعوم
 </p>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 }

 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 title="تفاصيل محاولة الامتحان"
 size="xl"
 >
 {content}
 </Modal>
 );
}
