"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { api } from "../../../../lib/axios/axios";
import { validateRecordingInput } from "../../../../lib/video/recording";
import LecturePlayer from "../LecturePlayer";
import {
 FiPlus,
 FiEdit2,
 FiTrash2,
 FiUploadCloud,
 FiCalendar,
 FiVideo,
 FiBookOpen,
} from "react-icons/fi";
import Modal from "../modal/Modal";
import Spinner from "../ui/Spinner";

const STATUS_STYLES = {
 published:
 "bg-emerald-50 border-emerald-200 text-emerald-700 ",
 scheduled:
 "bg-amber-50 border-amber-200 text-amber-700 ",
 draft:
 "bg-gray-50 border-gray-200 text-gray-600 ",
};

const STATUS_LABELS = {
 published: "منشورة",
 scheduled: "مجدولة",
 draft: "مسودة",
};

function RecordingBadge({ recording }) {
 if (!recording?.provider)
 return (
 <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-text-muted">
 بدون تسجيل
 </span>
 );
 return (
 <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ">
 {recording.provider === "youtube" ? "YouTube" : "Zoom"}
 </span>
 );
}

export function LectureForm({ initial, gradeId, onClose, onDone }) {
 const isEdit = !!initial;
 const [title, setTitle] = useState(initial?.title || "");
 const [description, setDescription] = useState(initial?.description || "");
 const [provider, setProvider] = useState(initial?.recording?.provider || "");
 const [url, setUrl] = useState(initial?.recording?.originalUrl || "");
 const [scheduledFor, setScheduledFor] = useState(() => {
 if (!initial?.scheduledFor) return "";
 try {
 return format(new Date(initial.scheduledFor), "yyyy-MM-dd'T'HH:mm");
 } catch {
 return "";
 }
 });
 const [publish, setPublish] = useState(initial?.status === "published");

 const preview = useMemo(() => {
 if (!provider || !url.trim()) return { state: "empty" };
 const res = validateRecordingInput({ provider, url: url.trim() });
 if (!res.ok) return { state: "invalid", message: res.message };
 return { state: "ready", recording: res.recording };
 }, [provider, url]);

 const mutation = useMutation({
 mutationFn: async () => {
 const payload = {
 gradeId,
 title,
 description,
 recording: provider ? { provider, url } : null,
 scheduledFor: scheduledFor || null,
 publish,
 };
 if (isEdit) {
 const { updateLecture } = await import("@/app/actions/lectureActions");
 return updateLecture({ lectureId: initial._id, ...payload });
 }
 const { createLecture } = await import("@/app/actions/lectureActions");
 return createLecture(payload);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success(isEdit ? "تم تحديث المحاضرة" : "تم إنشاء المحاضرة");
 onDone();
 } else toast.error(res?.message || "فشل الحفظ");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 const inputCls =
 "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none";

 return (
 <div className="space-y-4">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 العنوان
 </label>
 <input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 maxLength={200}
 className={inputCls}
 placeholder="مثال: الحصة الأولى — الاتزان الكيميائي"
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 الوصف
 </label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 rows={3}
 maxLength={2000}
 className={inputCls}
 placeholder="وصف مختصر للمحاضرة"
 />
 </div>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 مصدر التسجيل
 </label>
 <select
 value={provider}
 onChange={(e) => setProvider(e.target.value)}
 className={inputCls}
 >
 <option value="">بدون تسجيل</option>
 <option value="youtube">يوتيوب</option>
 <option value="zoom">زوم (تضمين فقط)</option>
 </select>
 </div>
 {provider && (
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 الرابط
 </label>
 <input
 value={url}
 onChange={(e) => setUrl(e.target.value)}
 dir="ltr"
 maxLength={2000}
 className={inputCls}
 placeholder={
 provider === "youtube"
 ? "https://youtu.be/..."
 : "https://zoom.us/rec/..."
 }
 />
 {provider === "zoom" && (
 <p className="mt-1 text-[11px] font-medium text-text-muted">
 بيعرض مشغل زوم الرسمي جوه المنصة.
 </p>
 )}
 </div>
 )}
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 معاينة الفيديو
 </label>
 {preview.state === "ready" ? (
 <LecturePlayer recording={preview.recording} />
 ) : (
 <p
 className={`rounded-xl border border-dashed py-8 text-center text-sm font-bold ${preview.state === "invalid" ? "border-red-200 bg-red-50 text-red-700 " : "border-border bg-background text-text-muted"}`}
 >
 {preview.state === "invalid"
 ? preview.message
 : "دخل رابط الفيديو عشان تشوف المعاينة"}
 </p>
 )}
 </div>
 <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 تاريخ الحصة (اختياري)
 </label>
 <input
 type="datetime-local"
 value={scheduledFor}
 onChange={(e) => setScheduledFor(e.target.value)}
 className={inputCls}
 />
 </div>
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-text-primary">
 <input
 type="checkbox"
 checked={publish}
 onChange={(e) => setPublish(e.target.checked)}
 className="h-4 w-4 rounded border-border text-brand-navy focus:ring-brand-navy"
 />
 نشر فوري للطلبة
 </label>
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <button
 onClick={onClose}
 className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-secondary hover:bg-background"
 >
 إلغاء
 </button>
 <button
 onClick={() => mutation.mutate()}
 disabled={mutation.isPending || title.trim().length < 2}
 className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-50"
 >
 {mutation.isPending ? "جاري التنفيذ..." : isEdit ? "حفظ" : "إنشاء"}
 </button>
 </div>
 </div>
 );
}

export default function LecturesSection({ role }) {
 const queryClient = useQueryClient();
 const [selectedGradeId, setSelectedGradeId] = useState("");
 const [formOpen, setFormOpen] = useState(false);
 const [editing, setEditing] = useState(null);

 const gradesQuery = useQuery({
 queryKey: role === "assistant" ? ["assistantGrades"] : ["activeGrades"],
 queryFn: async () => {
 if (role === "assistant") {
 const { getMyGradesForAssistant } =
 await import("@/app/actions/staffActions");
 const res = await getMyGradesForAssistant();
 if (!res?.success) throw new Error(res?.message || "Failed to fetch grades");
 return res.data;
 }
 const res = await api.get("/api/grades");
 if (!res?.data?.success)
 throw new Error(res?.data?.message || "Failed to fetch grades");
 return res.data.data;
 },
 refetchOnWindowFocus: false,
 });

 const lecturesQuery = useQuery({
 queryKey: ["lectures", selectedGradeId],
 queryFn: async () => {
 const { getLecturesForStaff } =
 await import("@/app/actions/lectureActions");
 const res = await getLecturesForStaff(selectedGradeId);
 if (!res?.success) throw new Error(res?.message || "Failed to fetch lectures");
 return res.data;
 },
 enabled: !!selectedGradeId,
 refetchOnWindowFocus: false,
 });

 const invalidate = () =>
 queryClient.invalidateQueries({ queryKey: ["lectures", selectedGradeId] });

 const statusMutation = useMutation({
 mutationFn: async ({ lectureId, status }) => {
 const { setLectureStatus } = await import("@/app/actions/lectureActions");
 return setLectureStatus(lectureId, status);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم التحديث");
 invalidate();
 } else toast.error(res?.message || "فشل التحديث");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 const removeMutation = useMutation({
 mutationFn: async (lectureId) => {
 const { removeLecture } = await import("@/app/actions/lectureActions");
 return removeLecture(lectureId);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم حذف المحاضرة");
 invalidate();
 } else toast.error(res?.message || "فشل الحذف");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 const busy = statusMutation.isPending || removeMutation.isPending;

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiBookOpen size={18} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 اختار صف عشان تشوف محاضراته
 </p>
 <p className="text-xs font-medium text-text-muted">
 المحاضرات مرتبطة بصف معين
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <select
 value={selectedGradeId}
 onChange={(e) => setSelectedGradeId(e.target.value)}
 className="min-w-[200px] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none sm:min-w-[220px]"
 >
 <option value="">اختار الصف</option>
 {(gradesQuery.data || []).map((g) => (
 <option key={g._id} value={g._id}>
 {g.name}
 </option>
 ))}
 </select>
 <button
 type="button"
 disabled={!selectedGradeId}
 onClick={() => {
 setEditing(null);
 setFormOpen(true);
 }}
 className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-40"
 >
 <FiPlus size={14} /> محاضرة جديدة
 </button>
 </div>
 </div>

 {!selectedGradeId ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-navy text-white">
 <FiVideo size={22} />
 </span>
 <p className="mt-4 text-base font-extrabold text-text-primary">
 اختار صف عشان تشوف محاضراته
 </p>
 <p className="mt-1 text-sm text-text-muted">
 المحاضرات متقسمة حسب الصف — اختار واحد من اللي فوق.
 </p>
 </div>
 ) : lecturesQuery.isLoading ? (
 <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
 <Spinner text="جاري التحميل..." />
 </div>
 ) : (lecturesQuery.data || []).length === 0 ? (
 <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiVideo size={20} />
 </span>
 <p className="mt-3 text-sm font-extrabold text-text-primary">
 لسه مفيش محاضرات في الصف ده
 </p>
 <p className="mt-1 text-xs text-text-muted">
 ابدأ بإضافة أول محاضرة بلينك يوتيوب أو زوم.
 </p>
 </div>
 ) : (
 <div className="grid gap-3">
 {lecturesQuery.data.map((lec) => (
 <div
 key={lec._id}
 className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border) sm:flex-row sm:items-start sm:justify-between"
 >
 <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
 <div className="min-w-0 flex-1 pt-1">
 <div className="mb-1 flex flex-wrap items-center gap-2">
 <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy border border-(--brand-navy-border)">
 <FiVideo size={12} />
 {lec.title}
 </span>
 <span
 className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[lec.status]}`}
 >
 {STATUS_LABELS[lec.status]}
 </span>
 <RecordingBadge recording={lec.recording} />
 </div>
 {lec.description && (
 <p className="mt-1 line-clamp-2 text-xs font-medium text-text-muted">
 {lec.description}
 </p>
 )}
 {lec.scheduledFor && (
 <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-text-muted">
 <FiCalendar size={11} />
 {format(new Date(lec.scheduledFor), "yyyy-MM-dd HH:mm")}
 </p>
 )}
 </div>
 <div className="flex shrink-0 items-center gap-1.5 self-start">
 {lec.status !== "published" ? (
 <button
 type="button"
 disabled={busy}
 onClick={() =>
 statusMutation.mutate({
 lectureId: lec._id,
 status: "published",
 })
 }
 className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
 >
 <FiUploadCloud size={12} /> نشر
 </button>
 ) : (
 <button
 type="button"
 disabled={busy}
 onClick={() =>
 statusMutation.mutate({
 lectureId: lec._id,
 status: "draft",
 })
 }
 className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-text-secondary hover:bg-background disabled:opacity-50"
 >
 إلغاء النشر
 </button>
 )}
 <button
 type="button"
 disabled={busy}
 onClick={() => {
 setEditing(lec);
 setFormOpen(true);
 }}
 className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-50"
 >
 <FiEdit2 size={12} />
 </button>
 <button
 type="button"
 disabled={busy}
 onClick={() => {
 if (window.confirm(`حذف "${lec.title}"؟`))
 removeMutation.mutate(lec._id);
 }}
 className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
 >
 <FiTrash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 <Modal
 isOpen={formOpen && !!selectedGradeId}
 onClose={() => {
 setFormOpen(false);
 setEditing(null);
 }}
 title={editing ? "تعديل المحاضرة" : "محاضرة جديدة"}
 >
 {selectedGradeId && (
 <LectureForm
 key={editing?._id || "new"}
 initial={editing}
 gradeId={selectedGradeId}
 onClose={() => {
 setFormOpen(false);
 setEditing(null);
 }}
 onDone={() => {
 setFormOpen(false);
 setEditing(null);
 invalidate();
 }}
 />
 )}
 </Modal>
 </div>
 );
}
