"use client";

import { useState, useCallback } from "react";
import { QuestionEngine } from "@/question-system/engine";
import QuestionRepositoryModal from "@/app/components/Repository/QuestionRepositoryModal";
import QuestionCollection from "./QuestionCollection/QuestionCollection";
import QuestionWorkspace from "./QuestionWorkspace/QuestionWorkspace";
import "@/question-system/plugins/multiple-choice/index";
import "@/question-system/plugins/true-false/index";
import "@/question-system/plugins/essay/index";
import "@/question-system/plugins/fill-blank/index";
import "@/question-system/plugins/matching/index";
import "@/question-system/plugins/image-choice/index";
import { FiPlus, FiBookOpen, FiSave, FiLayers } from "react-icons/fi";

export default function ExamGenerator({
 capabilities,
 context,
 contextSlot,
 contextValid = true,
 initialQuestions = [],
 examId = null,
 initialTitle = "",
 persistence,
 onSuccess,
}) {
 const [showNewQuestion, setShowNewQuestion] = useState(false);
 const [showRepositoryModal, setShowRepositoryModal] = useState(false);
 const [title, setTitle] = useState(initialTitle);

 const [state, setState] = useState(() => {
 const questions = initialQuestions?.length
 ? initialQuestions.map((q) => ({
 id: q.id || q._id || crypto.randomUUID(),
 ...q,
 }))
 : [];
 return {
 questions,
 selectedId: questions.length > 0 ? questions[0].id : null,
 dirty: false,
 saving: false,
 error: null,
 };
 });

 const selectedQuestion =
 state.questions.find((q) => q.id === state.selectedId) || null;

 function updateQuestionInList(id, changes) {
 setState((prev) => ({
 ...prev,
 questions: prev.questions.map((q) =>
 q.id === id ? { ...q, ...changes } : q,
 ),
 dirty: true,
 }));
 }
 function removeQuestion(id) {
 setState((prev) => {
 const next = prev.questions.filter((q) => q.id !== id);
 return {
 ...prev,
 questions: next,
 selectedId:
 prev.selectedId === id
 ? next.length > 0
 ? next[0].id
 : null
 : prev.selectedId,
 dirty: true,
 };
 });
 if (showNewQuestion && selectedQuestion?.id === id)
 setShowNewQuestion(false);
 }
 function duplicateQuestion(sourceId) {
 setState((prev) => {
 const idx = prev.questions.findIndex((q) => q.id === sourceId);
 if (idx === -1) return prev;
 const copy = QuestionEngine.duplicate(prev.questions[idx]);
 const next = [...prev.questions];
 next.splice(idx + 1, 0, copy);
 return { ...prev, questions: next, selectedId: copy.id, dirty: true };
 });
 }
 function addNewQuestion(q) {
 setState((prev) => ({
 ...prev,
 questions: [...prev.questions, { ...q, id: q.id || crypto.randomUUID() }],
 selectedId: q.id,
 dirty: true,
 }));
 setShowNewQuestion(false);
 }
 const addFromRepository = useCallback((questions) => {
 setState((prev) => {
 const newOnes = questions.map((q) => ({
 ...q,
 _id: q._id,
 id: crypto.randomUUID(),
 }));
 return {
 ...prev,
 questions: [...prev.questions, ...newOnes],
 selectedId: newOnes[0]?.id || prev.selectedId,
 dirty: true,
 };
 });
 }, []);
 const existingQuestionIds = state.questions.map((q) => q._id).filter(Boolean);
 function reorderQuestions(orderedIds) {
 setState((prev) => {
 const idMap = new Map(prev.questions.map((q) => [q.id, q]));
 const next = orderedIds.map((id) => idMap.get(id)).filter(Boolean);
 return { ...prev, questions: next, dirty: true };
 });
 }
 async function handleSave() {
 if (state.questions.length === 0) return;
 setState((prev) => ({ ...prev, saving: true, error: null }));
 try {
 let result;
 const payload = state.questions.map(({ id, ...rest }) =>
 rest._id ? { _id: rest._id, ...rest } : rest,
 );
 if (examId)
 result = await persistence.update({ examId, questions: payload });
 else
 result = await persistence.create({
 context,
 questions: payload,
 title,
 });
 if (result?.success) {
 setState((prev) => ({ ...prev, dirty: false, saving: false }));
 if (onSuccess) onSuccess(result, examId ? null : result);
 } else
 setState((prev) => ({
 ...prev,
 saving: false,
 error: result?.message || "حدث خطأ أثناء الحفظ",
 }));
 } catch (err) {
 setState((prev) => ({
 ...prev,
 saving: false,
 error: err.message || "حدث خطأ غير متوقع",
 }));
 }
 }

 return (
 <div className="mx-auto max-w-3xl space-y-5">
 <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-navy-border)] bg-[var(--brand-navy)] p-6 text-center shadow-sm sm:p-8">
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0 opacity-[0.08]"
 style={{
 backgroundImage:
 "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
 backgroundSize: "24px 24px",
 }}
 />
 <div
 aria-hidden
 className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl"
 />
 <div className="relative">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
 <FiLayers size={20} />
 </span>
 <h2 className="mt-3 text-xl font-extrabold text-white sm:text-2xl">
 {examId ? "تعديل الاختبار" : "إضافة اختبار جديد"}
 </h2>
 <p className="mt-1 text-sm font-medium text-white/80">
 {examId
 ? "عدّل الأسئلة بالأسفل"
 : "املأ البيانات بالأسفل لإنشاء اختبار جديد"}
 </p>
 </div>
 </div>

 <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
 <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-primary)]">
 عنوان الاختبار
 </label>
 <input
 type="text"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="مثال: اختبار شهري، تقييم الوحدة الأولى..."
 className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--brand-navy)] focus:ring-4 focus:ring-[var(--ring)] focus:outline-none"
 />
 </div>

 {contextSlot && (
 <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
 {contextSlot}
 </div>
 )}

 {state.error && (
 <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 ">
 {state.error}
 </div>
 )}

 <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <h3 className="flex items-center gap-2 text-sm font-extrabold text-[var(--text-primary)]">
 <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] border border-[var(--brand-navy-border)]">
 <FiBookOpen size={14} />
 </span>
 الأسئلة ({state.questions.length})
 </h3>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => setShowRepositoryModal(true)}
 disabled={!capabilities.canAddQuestion}
 className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)] px-4 py-2 text-sm font-bold text-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white disabled:opacity-50"
 >
 <FiLayers size={14} /> من البنك
 </button>
 <button
 type="button"
 onClick={() => {
 setShowNewQuestion(true);
 setState((prev) => ({ ...prev, selectedId: null }));
 }}
 disabled={!capabilities.canAddQuestion}
 className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-teal)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--brand-teal-hover)] disabled:opacity-50"
 >
 <FiPlus size={14} /> سؤال جديد
 </button>
 </div>
 </div>

 {showNewQuestion && (
 <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
 <QuestionWorkspace
 question={QuestionEngine.createBlank("multiple-choice")}
 capabilities={capabilities}
 isNew
 onAdd={addNewQuestion}
 />
 </div>
 )}

 {selectedQuestion && !showNewQuestion && (
 <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
 <QuestionWorkspace
 key={selectedQuestion.id}
 question={selectedQuestion}
 capabilities={capabilities}
 onSave={updateQuestionInList}
 />
 </div>
 )}

 <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
 <QuestionCollection
 questions={state.questions}
 selectedId={state.selectedId}
 capabilities={capabilities}
 onSelect={(id) => {
 setShowNewQuestion(false);
 setState((prev) => ({ ...prev, selectedId: id }));
 }}
 onDelete={removeQuestion}
 onDuplicate={duplicateQuestion}
 onReorder={reorderQuestions}
 />
 </div>

 <button
 type="button"
 onClick={handleSave}
 disabled={
 !capabilities.canSave ||
 state.questions.length === 0 ||
 state.saving ||
 !contextValid
 }
 className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-navy)] py-3 text-sm font-bold text-white hover:bg-[var(--brand-navy-hover)] disabled:opacity-50"
 >
 <FiSave size={16} /> {state.saving ? "جاري الحفظ..." : "حفظ الاختبار"}
 </button>

 <QuestionRepositoryModal
 isOpen={showRepositoryModal}
 onClose={() => setShowRepositoryModal(false)}
 onSelect={(questions) => {
 addFromRepository(questions);
 setShowRepositoryModal(false);
 }}
 existingQuestionIds={existingQuestionIds}
 />
 </div>
 );
}
