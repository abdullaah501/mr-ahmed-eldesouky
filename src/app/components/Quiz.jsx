"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { api } from "../../../lib/axios/axios";
import { addSubmission, saveQuizDraft } from "../actions/examActions";
import debounce from "../../../lib/debounce";
import {
 QUIZ_DRAFT_LOCAL_DEBOUNCE_MS,
 QUIZ_DRAFT_SYNC_DEBOUNCE_MS,
 buildInitialDraftState,
 clearLocalDraft,
 readLocalDraft,
 reconcileAnswers,
 sanitizeDraftAnswers,
 writeLocalDraft,
} from "../../../lib/quizDraft";
import Link from "next/link";
import { get } from "@/question-system/plugins/registry";
import "@/question-system/plugins/multiple-choice/index";
import "@/question-system/plugins/true-false/index";
import "@/question-system/plugins/essay/index";
import "@/question-system/plugins/fill-blank/index";
import "@/question-system/plugins/matching/index";
import "@/question-system/plugins/image-choice/index";
import {
 FiCheckCircle,
 FiXCircle,
 FiClock,
 FiHelpCircle,
 FiSend,
 FiAlertTriangle,
 FiEdit3,
} from "react-icons/fi";
import MathRenderer from "./math/MathRenderer";
import AtomOrbit from "./brand/AtomOrbit";
export default function Quiz({
 questions,
 lessonTitle,
 title,
 userId,
 examId,
 draft = null,
}) {
 const parsedUserId = typeof userId === "string" ? JSON.parse(userId) : userId;
 const questionIds = useMemo(
 () => (questions || []).map((q) => String(q._id)),
 [questions]
 );

 // Synchronous hydration: the reconciled draft is in place before any
 // question renderer mounts. fill-blank/matching/essay read userAnswer at
 // mount; MCQ/TF/image-choice restore through RHF defaultValues.
 const [initialDraft] = useState(() =>
 buildInitialDraftState({
 serverDraft: draft,
 localDraft:
 parsedUserId && examId ? readLocalDraft(parsedUserId, examId) : null,
 questionIds,
 })
 );

 const {
 register,
 handleSubmit,
 setValue,
 watch,
 trigger,
 formState: { errors, isSubmitted, isValid, isSubmitting },
 } = useForm({
 mode: "onChange",
 defaultValues: initialDraft.answers,
 });
 const [activeId, setActiveId] = useState(questions[0]?._id || null);
 const watchedValues = watch();

 if (!parsedUserId || !examId) {
 return (
 <div className="flex min-h-[260px] items-center justify-center">
 <div className="text-center">
 <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
 <p className="text-sm text-text-muted">جاري تحميل البيانات...</p>
 </div>
 </div>
 );
 }

 const { data, isLoading } = useQuery({
 queryKey: ["submission", parsedUserId, examId],
 queryFn: async () => {
 try {
 const res = await api.get(
 `/api/getSubmission?studentId=${parsedUserId}&examId=${examId}`,
 );
 return res.data;
 } catch (e) {
 return { success: false, message: "API error" };
 }
 },
 enabled: !!parsedUserId && !!examId,
 keepPreviousData: true,
 refetchOnWindowFocus: false,
 });

 const [correctScore, setCorrectScore] = useState(null);
 const [submittedAnswers, setSubmittedAnswers] = useState({});

 // ── Hybrid draft persistence ──────────────────────────────────────────
 // localStorage is the fast cache / offline buffer; MongoDB is canonical.
 const draftRef = useRef({
 answers: initialDraft.answers,
 baseAnswers: initialDraft.baseAnswers,
 serverRevision: initialDraft.serverRevision,
 });
 const submittedRef = useRef(false);
 const disposedRef = useRef(false);
 const syncingRef = useRef(false);
 const pendingSyncRef = useRef(false);
 const syncStateRef = useRef({ schedule: null });

 const localWrite = useMemo(
 () =>
 debounce(() => {
 if (!parsedUserId || !examId || submittedRef.current) return;
 writeLocalDraft(parsedUserId, examId, draftRef.current);
 }, QUIZ_DRAFT_LOCAL_DEBOUNCE_MS),
 [parsedUserId, examId]
 );

 const runSync = useCallback(async () => {
 if (!parsedUserId || !examId || disposedRef.current || submittedRef.current) {
 return;
 }
 if (syncingRef.current) {
 // A newer sync was requested while one is in flight — coalesce it.
 pendingSyncRef.current = true;
 return;
 }

 syncingRef.current = true;
 try {
 // At most two immediate attempts per invocation; anything left is
 // deferred to the next scheduled sync.
 for (let attempt = 0; attempt < 2; attempt += 1) {
 const state = draftRef.current;
 const sentAnswers = state.answers;
 const res = await saveQuizDraft({
 examId,
 baseRevision: state.serverRevision,
 answers: sentAnswers,
 });

 if (disposedRef.current) return;

 if (res?.success && res.submitted) {
 // Submitted on another device/tab — never resurrect the draft.
 submittedRef.current = true;
 clearLocalDraft(parsedUserId, examId);
 return;
 }
 if (res?.success) {
 // Do not touch state.answers: newer local edits made while the
 // request was in flight must survive.
 state.baseAnswers = sentAnswers;
 if (typeof res.revision === "number") {
 state.serverRevision = res.revision;
 }
 writeLocalDraft(parsedUserId, examId, state);
 return;
 }
 if (res?.conflict) {
 const serverAnswers = res.draft?.answers || {};
 const merged = reconcileAnswers({
 base: state.baseAnswers,
 local: state.answers,
 server: serverAnswers,
 });
 state.answers = merged;
 state.baseAnswers = serverAnswers;
 state.serverRevision = res.draft?.revision || 0;
 writeLocalDraft(parsedUserId, examId, state);
 continue; // one bounded retry with the fresh canonical base
 }
 return; // network/server error — local buffer stays authoritative
 }
 } catch {
 // Offline — the debounced local write already holds the draft.
 } finally {
 syncingRef.current = false;
 if (pendingSyncRef.current) {
 pendingSyncRef.current = false;
 syncStateRef.current.schedule?.();
 }
 }
 }, [parsedUserId, examId]);

 const scheduleSync = useMemo(
 () =>
 debounce(() => {
 void runSync();
 }, QUIZ_DRAFT_SYNC_DEBOUNCE_MS),
 [runSync]
 );

 useEffect(() => {
 syncStateRef.current.schedule = scheduleSync;
 return () => {
 syncStateRef.current.schedule = null;
 };
 }, [scheduleSync]);

 useEffect(() => {
 if (!parsedUserId || !examId) return undefined;
 // React StrictMode re-runs effects; a fresh setup re-arms synchronization.
 disposedRef.current = false;

 // Interruption safety is local-only: flush never performs a network call.
 const flushLocal = () => {
 if (submittedRef.current) return;
 writeLocalDraft(parsedUserId, examId, draftRef.current);
 };
 const onVisibilityChange = () => {
 if (document.visibilityState === "hidden") flushLocal();
 };
 const onOnline = () => {
 scheduleSync.cancel?.();
 void runSync();
 };

 window.addEventListener("pagehide", flushLocal);
 window.addEventListener("online", onOnline);
 document.addEventListener("visibilitychange", onVisibilityChange);

 return () => {
 flushLocal();
 disposedRef.current = true;
 localWrite.cancel?.();
 scheduleSync.cancel?.();
 window.removeEventListener("pagehide", flushLocal);
 window.removeEventListener("online", onOnline);
 document.removeEventListener("visibilitychange", onVisibilityChange);
 };
 }, [parsedUserId, examId, localWrite, scheduleSync, runSync]);

 useEffect(() => {
 const subscription = watch((values) => {
 if (submittedRef.current || disposedRef.current) return;
 const sanitized = sanitizeDraftAnswers(values, questionIds);
 draftRef.current.answers = sanitized;
 localWrite();
 scheduleSync();
 });
 return () => subscription?.unsubscribe?.();
 }, [watch, questionIds, localWrite, scheduleSync]);

 useEffect(() => {
 // A local draft newer than the server is pushed once on open; restore of
 // answers themselves is synchronous and never depends on this effect.
 if (initialDraft.dirty) scheduleSync();
 }, [initialDraft.dirty, scheduleSync]);

 useEffect(() => {
 if (Object.keys(initialDraft.answers).length > 0) {
 void trigger();
 }
 // Validation only — answers were hydrated synchronously above.
 }, [trigger, initialDraft.answers]);

 const onSubmit = async (formData) => {
 let correct = 0,
 wrong = 0;
 let essays = [],
 userAnswers = {},
 questionsAnswered = [];
 questions.forEach((q) => {
 const userAnswer = formData[q._id];
 const nUser = userAnswer?.trim?.().toLowerCase();
 const nCorrect = q.correctAnswer?.trim?.().toLowerCase();
 userAnswers[q._id] = userAnswer;
 if (q.type === "essay") {
 const essay = {
 questionId: q._id,
 question: q.questionText,
 type: q.type,
 answer: userAnswer,
 };
 if (q.image?.cloudId) essay.image = q.image;
 essays.push(essay);
 return;
 }
 const isCorrect = nUser === nCorrect;
 if (isCorrect) correct++;
 else wrong++;
 questionsAnswered.push({
 questionId: q._id,
 type: q.type,
 answer: userAnswer || null,
 isCorrect,
 });
 });
 setSubmittedAnswers(userAnswers);
 const submission = {
 student: parsedUserId,
 exam: examId,
 score: { correct, wrong },
 essays,
 questionsAnswered,
 isCompleted: essays.length === 0,
 };
 const result = await addSubmission(submission);
 if (!result.success) return;
 // Submission already deleted the server draft inside its transaction;
 // stop pending writes and drop the local buffer.
 submittedRef.current = true;
 clearLocalDraft(parsedUserId, examId);
 localWrite.cancel?.();
 scheduleSync.cancel?.();
 setCorrectScore(correct);
 };

 if (isLoading) {
 return (
 <div className="flex min-h-[260px] items-center justify-center">
 <div className="text-center">
 <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
 <p className="text-sm text-text-muted">جاري تحميل البيانات...</p>
 </div>
 </div>
 );
 }

 // Review — encouraging, not cold
 if (data?.success) {
 const submission = data.data;
 const total =
 questions.filter((q) => q.type !== "essay").length || questions.length;
 const correct = submission.score.correct;
 const pct = total ? Math.round((correct / total) * 100) : 0;
 const feedback =
 pct >= 85
 ? {
 title: "ممتاز! مستواك قوي جداً. استمر على كده.",
 color: "text-emerald-700",
 bg: "bg-emerald-50 border-emerald-200",
 }
 : pct >= 60
 ? {
 title:
 "أداء جيد! عندك أساس قوي، ومع مزيد من التدريب هتوصل لنتيجة أفضل.",
 color: "text-amber-800",
 bg: "bg-amber-50 border-amber-200",
 }
 : {
 title:
 "ولا يهمك. النتيجة دي بتساعدك تشوف إيه اللي محتاج تحسين. راجع الأسئلة وحاول مرة أخرى.",
 color: "text-brand-navy",
 bg: "bg-brand-navy-soft border-(--brand-navy-border)",
 };

 return (
 <div className="space-y-6">
 <div className="overflow-hidden rounded-3xl border border-[#073B40] bg-card shadow-sm">
 <div className="bg-gradient-to-bl from-[#073B40] to-[#0B5155] px-6 py-5 text-white sm:px-8 flex items-center gap-3">
 <Image
 src="/logo.png"
 alt="أ. أحمد الدسوقي — مدرس كيمياء"
 width={36}
 height={36}
 className="h-[36px] w-[36px] object-contain"
 />
 <div>
 <p className="text-xs font-bold text-white/70">النتيجة</p>
 <p className="text-sm font-bold">نتيجة الاختبار</p>
 </div>
 <span className="ms-auto rounded-full bg-[#FFB81C] px-3 py-1 text-xs font-bold text-[#3D2C00]">
 {new Date(submission.createdAt).toLocaleDateString("ar-EG")}
 </span>
 </div>

 <div className="px-6 py-8 sm:px-8">
 <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
 {/* score ring */}
 <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`النسبة المئوية ${pct}%`}>
 <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
 <circle
 cx="60"
 cy="60"
 r="52"
 fill="none"
 stroke="var(--border)"
 strokeWidth="12"
 />
 <circle
 cx="60"
 cy="60"
 r="52"
 fill="none"
 stroke="var(--brand-amber)"
 strokeWidth="12"
 strokeLinecap="round"
 strokeDasharray={`${(pct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
 />
 </svg>
 <div className="absolute inset-0 grid place-items-center">
 <div className="text-center">
 <p dir="ltr" className="text-3xl font-black tabular-nums text-text-primary">
 {pct}%
 </p>
 <p className="text-[11px] font-bold text-text-muted">
 {correct} من {total}
 </p>
 </div>
 </div>
 </div>
 <div className="text-center sm:text-right">
 <h2 className="text-2xl font-black text-text-primary">
 {pct >= 85 ? "ممتاز، أحسنت!" : pct >= 60 ? "أداء جيد!" : "بداية كويسة!"}
 </h2>
 <p className="mt-1 text-sm text-text-muted">
 أكملت الاختبار بنجاح.
 </p>
 <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold sm:justify-start">
 <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700">
 صحيحة: {submission.score.correct}
 </span>
 <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1.5 text-red-700">
 خاطئة: {submission.score.wrong}
 </span>
 <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-amber-800">
 بدون إجابة:{" "}
 {total - correct - submission.score.wrong >= 0
 ? total - correct - submission.score.wrong
 : 0}
 </span>
 </div>
 </div>
 </div>

 <div
 className={`mx-auto mt-6 max-w-2xl rounded-2xl border px-4 py-3 text-sm font-bold leading-relaxed ${feedback.bg} ${feedback.color}`}
 >
 {feedback.title}
 </div>
 </div>
 </div>

 <div className="space-y-4">
 {questions.map((q, idx) => {
 const answered = submission?.questionsAnswered?.find(
 (qa) => String(qa?.questionId) === String(q?._id),
 );
 const userAnswer = answered?.answer;
 const isCorrect = answered?.isCorrect;
 const isEssay = q.type === "essay";
 const status = isEssay
 ? "essay"
 : isCorrect === undefined
 ? "unanswered"
 : isCorrect
 ? "correct"
 : "wrong";
 const statusLabel = {
 essay: "مقالي — تصحيح يدوي",
 unanswered: "بدون إجابة",
 correct: "إجابة صحيحة",
 wrong: "إجابة خاطئة",
 }[status];
 const statusCls = {
 essay:
 "bg-[var(--brand-amber-soft)] text-[#7A5200] ",
 unanswered: "bg-background text-text-muted border border-border",
 correct: "bg-emerald-50 text-emerald-700",
 wrong: "bg-red-50 text-red-700",
 }[status];
 const cardBorder =
 status === "essay"
 ? "border-[var(--brand-amber-border)]"
 : status === "correct"
 ? "border-emerald-200"
 : status === "wrong"
 ? "border-red-200"
 : "border-border";
 return (
 <div
 key={q._id}
 className={`overflow-hidden rounded-2xl border-2 bg-card shadow-sm ${cardBorder}`}
 >
 <div className="flex gap-3 border-b border-border bg-background px-4 py-4 sm:px-5">
 <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#073B40] text-sm font-black text-white ">
 {idx + 1}
 </span>
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-[11px] font-black text-text-muted">
 سؤال {idx + 1}
 </span>
 <span
 className={`rounded-full px-2 py-0.5 text-[11px] font-black ${statusCls}`}
 >
 {statusLabel}
 </span>
 </div>
 <div className="mt-1.5 text-[15px] font-bold leading-loose text-text-primary sm:text-base">
 <MathRenderer text={q.questionText} />
 </div>
 </div>
 <span
 className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm ${isCorrect === undefined ? "bg-amber-50 border-amber-200 text-amber-700" : isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}
 >
 {isCorrect === undefined ? (
 <FiClock size={14} />
 ) : isCorrect ? (
 <FiCheckCircle size={14} />
 ) : (
 <FiXCircle size={14} />
 )}
 </span>
 </div>
 {q?.image?.cloudId && (
 <div className="border-b border-border bg-background/50 p-4">
 <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-border bg-card">
 <Image
 src={`/api/upload/proxyImage/${encodeURIComponent(q.image.cloudId)}`}
 alt={q.questionText}
 width={500}
 height={500}
 className="max-h-72 w-full object-contain"
 />
 </div>
 </div>
 )}
 <div className="p-4 sm:p-5">
 {(() => {
 const plugin = get(q.type);
 if (!plugin?.Renderer) return null;
 const R = plugin.Renderer;
 return (
 <R
 question={{ ...q, isCorrect }}
 register={null}
 isSubmitted={true}
 userAnswer={userAnswer}
 mode="review"
 />
 );
 })()}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 }

 // Active — quiet, focused
 if (data?.success === false) {
 const total = questions.length;
 const isAnsweredVal = (qid) => {
 const rawVal = watchedValues?.[qid];
 return typeof rawVal === "string" ? rawVal.trim().length > 0 : !!rawVal;
 };
 const answeredCount = questions.filter((q) => isAnsweredVal(q._id)).length;
 const progressPct =
 isSubmitted && correctScore !== null
 ? 100
 : total
 ? Math.round((answeredCount / total) * 100)
 : 0;

 const renderPill = (q, i, size = "md") => {
 const hasError = !!errors[q._id];
 const answered = isAnsweredVal(q._id);
 const isActive = activeId === q._id;
 let cls =
 "border-border bg-card text-text-muted hover:border-(--brand-navy-border) hover:bg-brand-navy-soft hover:text-brand-navy";
 if (isActive)
 cls =
 "border-[var(--brand-navy)] bg-[var(--brand-navy)] text-white shadow-sm";
 else if (hasError)
 cls = "border-amber-300 bg-amber-50 text-amber-800";
 else if (answered)
 cls =
 "border-[var(--brand-teal-border)] bg-[var(--brand-teal-soft)] text-emerald-700";
 const dims =
 size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-[13px]";
 return (
 <Link
 key={q._id}
 href={`#q-${q._id}`}
 onClick={() => setActiveId(q._id)}
 aria-current={isActive ? "true" : undefined}
 aria-label={`السؤال ${i + 1}${answered ? " تمت الإجابة" : " بدون إجابة"}${hasError ? " يحتاج مراجعة" : ""}`}
 className={`grid shrink-0 place-items-center rounded-xl border font-black transition-colors ${dims} ${cls}`}
 >
 {answered && !isActive ? (
 <span className="flex flex-col items-center leading-none">
 <span>{i + 1}</span>
 <span aria-hidden className="mt-0.5 h-1 w-1 rounded-full bg-current" />
 </span>
 ) : (
 i + 1
 )}
 </Link>
 );
 };

 return (
 <div className="space-y-5">
 {/* Exam header band */}
 <div className="overflow-hidden rounded-2xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] text-white shadow-sm">
 <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
 <span className="grid shrink-0 place-items-center">
 <AtomOrbit size={40} variant="dark" animated={false} />
 </span>
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-bold text-white/60">
 اختبار — أ. أحمد الدسوقي
 </p>
 <h2 className="truncate text-base font-black text-white sm:text-lg">
 {title || `اختبار في ${lessonTitle || "الكيمياء"}`}
 </h2>
 </div>
 <div className="flex shrink-0 flex-col items-end gap-1.5">
 <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
 <FiHelpCircle size={12} /> {total} سؤال
 </span>
 <span
 className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
 answeredCount === total
 ? "bg-[#FFB81C] text-[#3D2C00]"
 : "bg-white/10 text-white"
 }`}
 >
 أجبت {answeredCount} من {total}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-3 border-t border-white/10 bg-black/20 px-4 py-2.5 sm:px-5">
 <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
 <div
 className="h-full rounded-full bg-[#FFB81C] transition-all"
 style={{ width: `${progressPct}%` }}
 />
 </div>
 <span dir="ltr" className="text-xs font-black tabular-nums text-[#FFB81C]">
 {progressPct}%
 </span>
 </div>
 <p className="px-4 py-2.5 text-[11px] leading-relaxed text-white/60 sm:px-5">
 خد وقتك — تقدر تتنقل بين الأسئلة. اختار إجابة واحدة لكل سؤال، وبعدين
 سلّم إجاباتك.
 </p>
 </div>

 {/* Mobile navigator — horizontal scroll strip */}
 <div className="lg:hidden">
 <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
 {questions.map((q, i) => renderPill(q, i, "sm"))}
 </div>
 </div>

 <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start lg:gap-6">
 <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-4">
 {questions.map((question, index) => (
 <div
 key={question._id}
 id={`q-${question._id}`}
 onClick={() => setActiveId(question._id)}
 className={`scroll-mt-28 overflow-hidden rounded-2xl border-2 bg-card shadow-sm transition-all ${activeId === question._id ? "border-[var(--brand-teal)] shadow-md" : "border-border"}`}
 >
 <div className="flex gap-3 border-b border-border bg-background px-4 py-4 sm:px-5">
 <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#073B40] text-[15px] font-black text-white ">
 {index + 1}
 </span>
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-black text-text-muted">
 السؤال {index + 1} من {total}
 </p>
 <div className="mt-1.5 text-[15px] font-bold leading-loose text-text-primary sm:text-base">
 <MathRenderer text={question.questionText} />
 </div>
 </div>
 {errors[question._id] && (
 <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-50 border border-amber-200 text-amber-700">
 <FiAlertTriangle size={14} />
 </span>
 )}
 </div>

 {question?.image?.cloudId && (
 <div className="border-b border-border bg-background/50 p-4">
 <Link
 href={`/api/upload/proxyImage/${encodeURIComponent(question.image.cloudId)}`}
 target="_blank"
 className="mx-auto block max-w-md overflow-hidden rounded-xl border border-border bg-card"
 >
 <Image
 src={`/api/upload/proxyImage/${encodeURIComponent(question.image.cloudId)}`}
 alt={question.questionText}
 width={500}
 height={500}
 className="max-h-72 w-full object-contain"
 />
 </Link>
 </div>
 )}

 <div className="p-4 sm:p-5">
 {(() => {
 const plugin = get(question.type);
 if (!plugin?.Renderer)
 return (
 <p className="text-xs text-text-muted">
 نوع سؤال غير مدعوم
 </p>
 );
 const R = plugin.Renderer;
 return (
 <R
 question={question}
 register={register}
 setValue={setValue}
 isSubmitted={isSubmitted}
 userAnswer={
 submittedAnswers[question._id] ??
 initialDraft.answers[question._id]
 }
 mode="answer"
 />
 );
 })()}
 {errors[question._id] && (
 <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800">
 <FiAlertTriangle size={14} /> من فضلك اختار أو اكتب إجابة قبل المتابعة
 </div>
 )}
 </div>
 </div>
 ))}

 {!isSubmitted && (
 <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
 <div className="flex items-center gap-2 text-sm">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-navy-soft)] text-sm font-black text-[var(--brand-navy)]">
 {answeredCount}
 </span>
 <span className="font-bold text-text-secondary">
 من {total} سؤال تمت إجابته
 </span>
 </div>
 <button
 type="submit"
 disabled={!isValid || isSubmitting}
 className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--brand-amber)] bg-[var(--brand-amber)] px-8 py-3.5 text-sm font-extrabold text-[var(--brand-amber-ink)] shadow-sm hover:bg-[var(--brand-amber-hover)] hover:border-[var(--brand-amber-hover)] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] sm:w-auto sm:ms-auto"
 >
 {isSubmitting ? (
 <>
 <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />{" "}
 جاري التسليم...
 </>
 ) : (
 <>
 <FiSend size={16} /> تسليم الإجابات
 </>
 )}
 </button>
 </div>
 {!isValid && (
 <p className="mt-2 text-xs font-semibold text-text-muted">
 أكمل كل الأسئلة المطلوبة عشان يتفعل التسليم.
 </p>
 )}
 </div>
 )}
 </form>

 {/* Desktop navigator rail */}
 <aside className="hidden lg:block" aria-label="التنقل بين الأسئلة">
 <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
 <div className="border-b border-border bg-background px-4 py-3">
 <p className="text-sm font-black text-text-primary">
 أسئلة الاختبار
 </p>
 <p className="mt-0.5 text-xs font-bold text-text-muted">
 أجبت {answeredCount} من {total}
 </p>
 </div>
 <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto p-3">
 {questions.map((q, i) => renderPill(q, i))}
 </div>
 <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-[11px] font-bold text-text-muted">
 <span className="flex items-center gap-1">
 <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
 تمت الإجابة
 </span>
 <span className="flex items-center gap-1">
 <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" />
 يحتاج مراجعة
 </span>
 </div>
 </div>
 </aside>
 </div>

 {isSubmitted && correctScore !== null && (
 <div className="rounded-3xl border border-[var(--brand-teal-border)] bg-brand-teal-soft p-6 text-center sm:p-8">
 <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-teal border border-[var(--brand-teal-border)] shadow-sm">
 <FiCheckCircle size={28} />
 </div>
 <h3 className="mt-3 text-xl font-black text-text-primary">
 تم تسليم إجاباتك بنجاح!
 </h3>
 <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
 <span className="text-sm font-bold text-text-muted">الدرجة:</span>
 <span
 className={`text-lg font-black ${correctScore >= questions.filter((q) => q.type !== "essay").length / 2 ? "text-emerald-700" : "text-red-600"}`}
 >
 {correctScore} /{" "}
 {questions.filter((q) => q.type !== "essay").length}
 </span>
 </div>
 {questions.some((q) => q.type === "essay") && (
 <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-brand-navy">
 <FiEdit3 size={13} /> الأسئلة المقالية بتتصحح يدوياً
 </p>
 )}
 </div>
 )}
 </div>
 );
 }

 return null;
}
