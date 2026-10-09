import { FaCheckCircle } from "react-icons/fa";
import QuestionCard from "./QuestionCard";
import { useCallback, useState } from "react";
import { updateSubmission } from "@/app/actions/examActions";
import toast from "react-hot-toast";
import { FiUser, FiMail, FiAward } from "react-icons/fi";

export default function EssayCard({ essay, queryClient, currentPage }) {
 const questions = essay?.essays || [];
 const user = essay?.userId;
 const [qCount, setQCount] = useState({
 correct: [],
 wrong: [],
 currentType: { type: "", id: "" },
 });
 const { currentType } = qCount;
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleCount = useCallback((type, id) => {
 setQCount((prev) => {
 const requested = prev[type] || [];
 const oppositeType = type === "correct" ? "wrong" : "correct";
 const opposite = prev[oppositeType] || [];
 if (requested.includes(id)) return prev;
 if (opposite.includes(id)) {
 return {
 ...prev,
 [type]: [...requested, id],
 [oppositeType]: opposite.filter((i) => i !== id),
 };
 }
 return {
 ...prev,
 [type]: [...requested, id],
 };
 });
 }, []);

 const getQuestionAndAnswered = useCallback(
 () =>
 questions.map((q) => ({
 questionId: q.questionId,
 type: "essay",
 answer: q.answer,
 isCorrect: qCount.correct.includes(q._id),
 })),
 [questions, qCount],
 );

 const handleSubmit = async () => {
 const arrayOfQuestions = getQuestionAndAnswered();
 setIsSubmitting(true);
 try {
 const res = await updateSubmission({
 submissionId: essay.submissionId,
 arrayOfQuestions,
 correct: qCount.correct.length,
 wrong: qCount.wrong.length,
 });
 if (!res.success) toast.error(res.message || "حصل خطأ");
 else {
 queryClient.invalidateQueries(["essays", currentPage]);
 toast.success(res.message || "تم حفظ النتيجة");
 }
 } catch (e) {
 toast.error(e.message || "حصل خطأ");
 } finally {
 setIsSubmitting(false);
 }
 };

 const noChanges = qCount.correct.length === 0 && qCount.wrong.length === 0;
 const pct = questions.length
 ? Math.round((qCount.correct.length / questions.length) * 100)
 : 0;

 return (
 <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-(--brand-navy-border)">
 <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
 <div className="flex flex-col gap-4">
 <div className="flex items-center gap-3 rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft p-4">
 <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white font-black">
 {user?.firstName?.charAt(0) || "?"}
 </span>
 <div className="min-w-0">
 <p className="text-sm font-extrabold text-text-primary">
 {user?.firstName} {user?.lastName}
 </p>
 <p className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
 <FiMail size={11} />
 {user?.email}
 </p>
 </div>
 <span className="ms-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white border border-(--brand-navy-border) px-3 py-1 text-xs font-bold text-brand-navy">
 {questions.length} أسئلة
 </span>
 </div>

 {(essay?.examTitle || essay?.gradeName) && (
 <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-text-muted">
 {essay?.examTitle && (
 <span>
 الامتحان:{" "}
 <span className="font-bold text-text-primary">
 {essay.examTitle}
 </span>
 </span>
 )}
 {essay?.gradeName && (
 <span>
 الصف:{" "}
 <span className="font-bold text-text-primary">
 {essay.gradeName}
 </span>
 </span>
 )}
 </div>
 )}

 <div className="rounded-xl border border-border bg-background p-4">
 <div className="mb-3 flex items-center gap-2">
 <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-navy text-white text-xs font-black">
 س
 </span>
 <h3 className="text-sm font-extrabold text-brand-navy">
 الأسئلة
 </h3>
 <span className="ms-auto rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-text-muted">
 {questions.length} أسئلة
 </span>
 </div>
 <div className="max-h-[380px] overflow-y-auto pr-1">
 <QuestionCard
 questions={questions}
 handleCount={handleCount}
 currentType={currentType}
 />
 </div>
 </div>

 <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
 <FiAward size={18} />
 </span>
 <div>
 <p className="text-xs font-bold text-emerald-800 ">
 الدرجة الحالية
 </p>
 <p className="text-base font-black text-text-primary">
 <span className="text-emerald-600">
 {qCount.correct.length}
 </span>
 <span className="mx-1 text-text-muted">/</span>
 {questions.length}
 </p>
 </div>
 </div>
 {questions.length > 0 && (
 <div className="text-right">
 <p className="text-xs font-bold text-text-muted">نسبة الدقة</p>
 <p className="text-lg font-black text-emerald-600">{pct}%</p>
 </div>
 )}
 </div>

 <div className="flex justify-end">
 <button
 onClick={handleSubmit}
 disabled={noChanges || isSubmitting}
 className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all ${noChanges || isSubmitting ? "bg-gray-300 cursor-not-allowed text-white/80" : "bg-brand-navy hover:bg-(--brand-navy-hover) hover:shadow-md active:scale-[0.98]"}`}
 >
 <FaCheckCircle
 className={isSubmitting ? "animate-spin" : ""}
 size={16}
 />
 <span>{isSubmitting ? "جاري الحفظ..." : "حفظ النتايج"}</span>
 </button>
 </div>
 </div>
 </div>
 );
}
