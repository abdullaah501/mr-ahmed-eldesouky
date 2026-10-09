"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import debounce from "../../../../../lib/debounce";
import {
 SELECTION_MODE_ALL_FILTERED,
 buildExportRequest,
 exportSelectionReducer,
 initialExportSelection,
} from "../../../../../lib/repository/exportSelection";
import { getCapabilities } from "@/question-system/capabilities";
import { QuestionEngine } from "@/question-system/engine";
import QuestionWorkspace from "@/app/components/Exams/ExamGenerator/QuestionWorkspace/QuestionWorkspace";
import "@/question-system/plugins/multiple-choice/index";
import "@/question-system/plugins/true-false/index";
import "@/question-system/plugins/essay/index";
import "@/question-system/plugins/fill-blank/index";
import "@/question-system/plugins/matching/index";
import "@/question-system/plugins/image-choice/index";
import { useRepositorySearch } from "@/hooks/useRepositorySearch";
import QuestionList from "@/app/components/Repository/QuestionList";
import QuestionFilters from "@/app/components/Repository/QuestionFilters";
import ImportRepositoryModal from "@/app/components/Repository/ImportRepositoryModal";
import AIGeneratorModal from "@/app/components/Repository/AIGeneratorModal";
import {
 createRepositoryQuestion,
 updateRepositoryQuestion,
 deleteRepositoryQuestion,
 archiveRepositoryQuestion,
 duplicateRepositoryQuestion,
 getRepositoryStatsAction,
 bulkDeleteRepositoryQuestions,
} from "@/app/actions/repositoryActions";
import { FiPlus, FiUpload, FiCpu, FiSearch, FiFilter, FiDownload } from "react-icons/fi";
import { LuFlaskConical } from "react-icons/lu";

const EMPTY_FILTERS = {
 search: "",
 type: [],
 difficulty: [],
 source: [],
 grade: [],
 subject: [],
};
const debouncedSetSearch = debounce((fn) => fn(), 350);

export default function RepositoryClient({ user, isAssistant }) {
 const queryClient = useQueryClient();
 // The Question Bank opens with the teacher's default subject selected;
 // the selector remains fully editable and "مسح الفلاتر" resets it.
 const [filters, setFilters] = useState({
 ...EMPTY_FILTERS,
 subject: ["الكيمياء"],
 type: ["multiple-choice", "image-choice"],
 });
 const [searchInput, setSearchInput] = useState("");
 const [selection, dispatchSelection] = useReducer(
 exportSelectionReducer,
 initialExportSelection
 );
 const [includeAnswers, setIncludeAnswers] = useState(false);
 const [isExporting, setIsExporting] = useState(false);
 const selectedIds = useMemo(
 () => new Set(selection.selectedIds),
 [selection.selectedIds]
 );
 const excludedIds = useMemo(
 () => new Set(selection.excludedIds),
 [selection.excludedIds]
 );
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showImportModal, setShowImportModal] = useState(false);
 const [showAIGenerator, setShowAIGenerator] = useState(false);
 const [editingQuestion, setEditingQuestion] = useState(null);
 const [showFilters, setShowFilters] = useState(false);

 const { data: statsData } = useQuery({
 queryKey: ["repositoryStats"],
 queryFn: async () => {
 const res = await getRepositoryStatsAction();
 return res.success ? res.stats : null;
 },
 staleTime: 60 * 1000,
 });

 const activeFilters = useMemo(
 () => ({
 search: filters.search || undefined,
 type: filters.type?.length ? filters.type : undefined,
 difficulty: filters.difficulty?.length ? filters.difficulty : undefined,
 source: filters.source?.length ? filters.source : undefined,
 grade: filters.grade?.length ? filters.grade : undefined,
 subject: filters.subject?.length ? filters.subject : undefined,
 limit: 30,
 }),
 [filters],
 );

 useEffect(() => {
 // All-filtered intent is bound to the filters that created it; a filter
 // change resets it so old exclusions cannot leak into a new set.
 dispatchSelection({ type: "filtersChanged" });
 }, [filters]);

 const {
 data,
 isLoading,
 isError,
 hasNextPage,
 isFetchingNextPage,
 fetchNextPage,
 refetch,
 } = useRepositorySearch(activeFilters);

 const handleSearchChange = useCallback((value) => {
 setSearchInput(value);
 debouncedSetSearch(() => {
 setFilters((prev) => ({ ...prev, search: value }));
 });
 }, []);

 const toggleSelect = useCallback(
 (id, checked) => {
 dispatchSelection(
 selection.mode === SELECTION_MODE_ALL_FILTERED
 ? { type: "toggleExclusion", id, checked }
 : { type: "toggleExplicit", id, checked }
 );
 },
 [selection.mode],
 );

 const handleCreate = useCallback(
 async (q) => {
 const res = await createRepositoryQuestion({
 type: q.type,
 questionText: q.questionText,
 correctAnswer: q.correctAnswer,
 options: q.options,
 config: q.config,
 image: q.image,
 difficulty: q.difficulty,
 grade: q.grade,
 subject: q.subject,
 tags: q.tags,
 });
 if (res.success) {
 toast.success("Question created successfully");
 setShowCreateModal(false);
 await queryClient.invalidateQueries({ queryKey: ["repository"] });
 await queryClient.invalidateQueries({ queryKey: ["repositoryStats"] });
 } else toast.error(res.message || "Error creating question");
 },
 [queryClient],
 );

 const handleEdit = useCallback(
 async (id, changes) => {
 const res = await updateRepositoryQuestion({
 id: editingQuestion._id,
 data: changes,
 });
 if (res.success) {
 toast.success("Question updated");
 setEditingQuestion(null);
 await queryClient.invalidateQueries({ queryKey: ["repository"] });
 await queryClient.invalidateQueries({ queryKey: ["repositoryStats"] });
 } else toast.error(res.message || "Error updating");
 },
 [editingQuestion, queryClient],
 );

 const handleDelete = useCallback(
 async (id) => {
 const res = await deleteRepositoryQuestion(id);
 if (res.success) {
 toast.success("Question deleted");
 await queryClient.invalidateQueries({ queryKey: ["repository"] });
 await queryClient.invalidateQueries({ queryKey: ["repositoryStats"] });
 } else toast.error(res.message || "Error deleting");
 },
 [queryClient],
 );

 const handleDuplicate = useCallback(
 async (id) => {
 const res = await duplicateRepositoryQuestion(id);
 if (res.success) {
 toast.success("Question duplicated");
 await queryClient.invalidateQueries({ queryKey: ["repository"] });
 } else toast.error(res.message || "Error duplicating");
 },
 [queryClient],
 );

 const handleBulkDelete = useCallback(async () => {
 const res = await bulkDeleteRepositoryQuestions([...selection.selectedIds]);
 if (res.success) {
 toast.success(`Deleted ${res.modifiedCount} questions`);
 dispatchSelection({ type: "clearSelection" });
 await queryClient.invalidateQueries({ queryKey: ["repository"] });
 await queryClient.invalidateQueries({ queryKey: ["repositoryStats"] });
 } else toast.error(res.message || "Bulk delete failed");
 }, [selection.selectedIds, queryClient]);

 const handleSelectAllFiltered = useCallback(() => {
 dispatchSelection({ type: "selectAllFiltered" });
 }, []);

 const handleExport = useCallback(async () => {
 // Compact request only: ids or filters+exclusions + includeAnswers.
 const request = buildExportRequest(selection, { filters, includeAnswers });
 setIsExporting(true);
 try {
 const res = await fetch("/api/repository/export/docx", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(request),
 });
 if (!res.ok) {
 let message = "Export failed";
 try {
 const payload = await res.json();
 message = payload?.message || message;
 } catch (_) {}
 toast.error(message);
 return;
 }
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = "questions-export.docx";
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 URL.revokeObjectURL(url);
 toast.success("Export ready");
 } catch {
 toast.error("Export failed");
 } finally {
 setIsExporting(false);
 }
 }, [selection, filters, includeAnswers]);

 const handleImportSuccess = useCallback(
 async (report) => {
 // Single authoritative invalidation point for completed import/AI
 // generation operations — the Question Bank list query is
 // ["repository", filters] (prefix-matched) plus its stats query.
 const importedCount = Number(report?.imported ?? 0);
 if (importedCount > 0) {
 await queryClient.invalidateQueries({ queryKey: ["repository"] });
 await queryClient.invalidateQueries({ queryKey: ["repositoryStats"] });
 }
 },
 [queryClient],
 );

 const allItems = useMemo(
 () => data?.pages?.flatMap((p) => p.items || []) ?? [],
 [data],
 );
 const total = statsData?.total ?? allItems.length;
 const capabilities = getCapabilities("lesson-create");

 return (
 <div className="space-y-4">
 {/* Stats + Actions bar */}
 <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <LuFlaskConical size={20} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 {total.toLocaleString("ar-EG")} سؤال في البنك
 </p>
 <p className="text-xs font-medium text-text-muted">
 ابحث وفلتر واختار للتعديل الجماعي
 </p>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={handleSelectAllFiltered}
 disabled={selection.mode === SELECTION_MODE_ALL_FILTERED}
 className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-text-secondary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
 >
 تحديد الكل
 </button>
 <label className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-text-secondary">
 <input
 type="checkbox"
 checked={includeAnswers}
 onChange={(e) => setIncludeAnswers(e.target.checked)}
 className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400"
 />
 تضمين الإجابات الصحيحة
 </label>
 <button
 type="button"
 onClick={handleExport}
 disabled={
 isExporting ||
 (selection.mode !== SELECTION_MODE_ALL_FILTERED &&
 selectedIds.size === 0)
 }
 className="inline-flex items-center gap-1.5 rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
 >
 <FiDownload size={14} /> {isExporting ? "جاري التصدير..." : "تصدير Word"}
 </button>
 <button
 type="button"
 onClick={() => setShowImportModal(true)}
 className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-text-secondary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy"
 >
 <FiUpload size={14} /> استيراد
 </button>
 <button
 type="button"
 onClick={() => setShowAIGenerator(true)}
 className="inline-flex items-center gap-1.5 rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-navy hover:text-white"
 >
 <FiCpu size={14} /> توليد بالذكاء الاصطناعي
 </button>
 <button
 type="button"
 onClick={() => setShowCreateModal(true)}
 className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white hover:bg-(--brand-navy-hover) shadow-sm"
 >
 <FiPlus size={14} /> سؤال جديد
 </button>
 </div>
 </div>

 {/* Toolbar */}
 <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <FiSearch
 className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted"
 size={16}
 />
 <input
 type="text"
 placeholder="دوّر على سؤال..."
 value={searchInput}
 onChange={(e) => handleSearchChange(e.target.value)}
 className="w-full rounded-xl border border-border bg-card py-2.5 pr-10 pl-4 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
 />
 </div>
 <button
 type="button"
 onClick={() => setShowFilters((v) => !v)}
 className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold md:hidden ${showFilters ? "border-brand-navy bg-brand-navy-soft text-brand-navy" : "border-border bg-card text-text-secondary"}`}
 >
 <FiFilter size={14} /> الفلاتر
 </button>
 </div>
 {selection.mode === SELECTION_MODE_ALL_FILTERED && (
 <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft p-3">
 <span className="text-sm font-bold text-brand-navy">
 تم تحديد كل الأسئلة المطابقة للفلاتر الحالية
 {excludedIds.size > 0 ? ` — ${excludedIds.size} مستبعد` : ""}
 </span>
 <button
 type="button"
 onClick={() => dispatchSelection({ type: "clearSelection" })}
 className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-background"
 >
 مسح التحديد
 </button>
 </div>
 )}
 {selection.mode !== SELECTION_MODE_ALL_FILTERED &&
 selectedIds.size > 0 && (
 <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft p-3">
 <span className="text-sm font-bold text-brand-navy">
 {selectedIds.size} محدد
 </span>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={handleBulkDelete}
 className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
 >
 حذف المحدد
 </button>
 <button
 type="button"
 onClick={() => dispatchSelection({ type: "clearSelection" })}
 className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-background"
 >
 إلغاء
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Body: filters + list */}
 <div className="flex gap-4">
 <div
 className={`w-64 shrink-0 ${showFilters ? "block" : "hidden md:block"}`}
 >
 <div className="sticky top-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
 <QuestionFilters filters={filters} onChange={setFilters} />
 </div>
 </div>
 <div className="min-w-0 flex-1">
 <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
 <div className="h-[calc(100vh-280px)] min-h-[400px]">
 <QuestionList
 data={data}
 isLoading={isLoading}
 isError={isError}
 hasNextPage={hasNextPage}
 isFetchingNextPage={isFetchingNextPage}
 fetchNextPage={fetchNextPage}
 selection={selection}
 onToggleSelect={toggleSelect}
 onPreview={(q) => setEditingQuestion(q)}
 />
 </div>
 </div>
 </div>
 </div>

 {showImportModal && (
 <ImportRepositoryModal
 onClose={() => setShowImportModal(false)}
 onSuccess={handleImportSuccess}
 />
 )}
 {showAIGenerator && (
 <AIGeneratorModal
 onClose={() => setShowAIGenerator(false)}
 />
 )}

 {showCreateModal && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
 onClick={() => setShowCreateModal(false)}
 >
 <div
 className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
 <h2 className="text-base font-extrabold text-text-primary">
 سؤال جديد
 </h2>
 <button
 onClick={() => setShowCreateModal(false)}
 className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-card text-text-muted hover:bg-brand-navy-soft hover:text-brand-navy"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <line x1="18" y1="6" x2="6" y2="18" />
 <line x1="6" y1="6" x2="18" y2="18" />
 </svg>
 </button>
 </div>
 <div className="overflow-auto p-6">
 <QuestionWorkspace
 question={QuestionEngine.createBlank("multiple-choice")}
 capabilities={capabilities}
 isNew
 showRepositoryFields
 onAdd={handleCreate}
 />
 </div>
 </div>
 </div>
 )}

 {editingQuestion && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
 onClick={() => setEditingQuestion(null)}
 >
 <div
 className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
 <h2 className="text-base font-extrabold text-text-primary">
 تعديل السؤال
 </h2>
 <button
 onClick={() => setEditingQuestion(null)}
 className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-card text-text-muted hover:bg-brand-navy-soft hover:text-brand-navy"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <line x1="18" y1="6" x2="6" y2="18" />
 <line x1="6" y1="6" x2="18" y2="18" />
 </svg>
 </button>
 </div>
 <div className="overflow-auto p-6">
 <QuestionWorkspace
 question={editingQuestion}
 capabilities={capabilities}
 showRepositoryFields
 onSave={handleEdit}
 />
 <div className="mt-6 flex gap-2 border-t border-border pt-4">
 <button
 type="button"
 onClick={() => handleDuplicate(editingQuestion._id)}
 className="rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-navy hover:text-white"
 >
 تكرار السؤال
 </button>
 <button
 type="button"
 onClick={() => handleDelete(editingQuestion._id)}
 className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 "
 >
 حذف السؤال
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
