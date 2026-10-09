"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../../../../lib/axios/axios";
import {
 FiPlus,
 FiEdit2,
 FiTrash2,
 FiMapPin,
 FiLink,
 FiCalendar,
 FiClock,
} from "react-icons/fi";
import Modal from "../modal/Modal";
import Spinner from "../ui/Spinner";
import {
 formatCairo,
 cairoDateKey,
 cairoTimeKey,
 cairoWeekday,
} from "../../../../lib/schedule/time";
import Link from "next/link";

const DAYS_AR = [
 "الأحد",
 "الاثنين",
 "الثلاثاء",
 "الأربعاء",
 "الخميس",
 "الجمعة",
 "السبت",
];
const MODE_LABELS = { offline: "حضور", online: "أونلاين" };
const inputCls =
 "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none";

function EventForm({ initial, gradeId, onClose, onDone }) {
 const queryClient = useQueryClient();
 const isEdit = !!initial;
 const [form, setForm] = useState({
 title: initial?.title || "",
 date: initial?.startAt ? cairoDateKey(new Date(initial.startAt)) : "",
 startTime: initial?.startAt ? cairoTimeKey(new Date(initial.startAt)) : "",
 endTime: initial?.endAt ? cairoTimeKey(new Date(initial.endAt)) : "",
 mode: initial?.mode || "offline",
 locationName: initial?.location?.name || "",
 locationAddress: initial?.location?.address || "",
 onlineUrl: initial?.onlineUrl || "",
 weekly: initial?.recurrence?.type === "weekly",
 });

 const mutation = useMutation({
 mutationFn: async () => {
 const payload = {
 gradeId,
 title: form.title.trim(),
 date: form.date,
 startTime: form.startTime,
 endTime: form.endTime || null,
 mode: form.mode,
 locationName: form.locationName,
 locationAddress: form.locationAddress,
 onlineUrl: form.onlineUrl,
 weekly: form.weekly,
 };
 if (isEdit) {
 const { updateScheduleEvent } =
 await import("@/app/actions/scheduleActions");
 return updateScheduleEvent({ eventId: initial._id, ...payload });
 }
 const { createScheduleEvent } =
 await import("@/app/actions/scheduleActions");
 return createScheduleEvent(payload);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success(isEdit ? "تم تحديث الموعد" : "تمت إضافة الموعد");
 queryClient.invalidateQueries({
 queryKey: ["scheduleEvents", gradeId],
 });
 onDone();
 } else toast.error(res?.message || "فشل الحفظ");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 function submit() {
 if (form.title.trim().length < 2) {
 toast.error("عنوان الموعد مطلوب");
 return;
 }
 if (!form.date || !form.startTime) {
 toast.error("التاريخ ووقت البداية مطلوبين");
 return;
 }
 if (form.endTime && form.endTime <= form.startTime) {
 toast.error("وقت النهاية لازم يكون بعد وقت البداية");
 return;
 }
 if (
 form.mode === "online" &&
 form.onlineUrl &&
 !form.onlineUrl.startsWith("https://")
 ) {
 toast.error("لينك الاجتماع لازم يبدأ بـ https");
 return;
 }
 mutation.mutate();
 }
 const set = (patch) => setForm((f) => ({ ...f, ...patch }));
 return (
 <div className="space-y-4">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 عنوان الموعد
 </label>
 <input
 value={form.title}
 onChange={(e) => set({ title: e.target.value })}
 maxLength={200}
 className={inputCls}
 placeholder="حصة كيمياء، مراجعة نهائية، اجتماع..."
 />
 </div>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 التاريخ (بتوقيت مصر)
 </label>
 <input
 type="date"
 value={form.date}
 onChange={(e) => set({ date: e.target.value })}
 className={inputCls}
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 وقت البداية
 </label>
 <input
 type="time"
 value={form.startTime}
 onChange={(e) => set({ startTime: e.target.value })}
 className={inputCls}
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 وقت النهاية (اختياري)
 </label>
 <input
 type="time"
 value={form.endTime}
 onChange={(e) => set({ endTime: e.target.value })}
 className={inputCls}
 />
 </div>
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 نوع الحصة
 </label>
 <div className="flex gap-3 text-sm font-bold">
 <label
 className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 ${form.mode === "offline" ? "border-brand-navy bg-brand-navy-soft text-brand-navy" : "border-border bg-card text-text-muted"}`}
 >
 <input
 type="radio"
 checked={form.mode === "offline"}
 onChange={() => set({ mode: "offline" })}
 className="text-brand-navy focus:ring-brand-navy"
 />{" "}
 حضور
 </label>
 <label
 className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 ${form.mode === "online" ? "border-brand-navy bg-brand-navy-soft text-brand-navy" : "border-border bg-card text-text-muted"}`}
 >
 <input
 type="radio"
 checked={form.mode === "online"}
 onChange={() => set({ mode: "online" })}
 className="text-brand-navy focus:ring-brand-navy"
 />{" "}
 أونلاين
 </label>
 </div>
 </div>
 {form.mode === "offline" ? (
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 المكان (اختياري)
 </label>
 <input
 value={form.locationName}
 onChange={(e) => set({ locationName: e.target.value })}
 maxLength={200}
 className={inputCls}
 placeholder="مدرسة النصر، سنتر..."
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 العنوان (اختياري)
 </label>
 <input
 value={form.locationAddress}
 onChange={(e) => set({ locationAddress: e.target.value })}
 maxLength={300}
 className={inputCls}
 placeholder="العنوان بالتفصيل"
 />
 </div>
 </div>
 ) : (
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 لينك الاجتماع (اختياري)
 </label>
 <input
 value={form.onlineUrl}
 onChange={(e) => set({ onlineUrl: e.target.value })}
 dir="ltr"
 maxLength={2000}
 className={`${inputCls} font-mono`}
 placeholder="https://..."
 />
 </div>
 )}
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-text-primary">
 <input
 type="checkbox"
 checked={form.weekly}
 onChange={(e) => set({ weekly: e.target.checked })}
 className="h-4 w-4 rounded border-border text-brand-navy focus:ring-brand-navy"
 />
 موعد أسبوعي (بيتكرر كل أسبوع في نفس اليوم والوقت)
 </label>
 <div className="flex justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={onClose}
 className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-secondary hover:bg-background"
 >
 إلغاء
 </button>
 <button
 type="button"
 onClick={submit}
 disabled={mutation.isPending}
 className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-50"
 >
 {mutation.isPending ? "جاري التنفيذ..." : isEdit ? "حفظ" : "إضافة"}
 </button>
 </div>
 </div>
 );
}

export default function ScheduleSection({ role = "admin" }) {
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

 const eventsQuery = useQuery({
 queryKey: ["scheduleEvents", selectedGradeId],
 queryFn: async () => {
 const { listScheduleEventsForStaff } =
 await import("@/app/actions/scheduleActions");
 const res = await listScheduleEventsForStaff(selectedGradeId);
 if (!res?.success) throw new Error(res?.message || "Failed to fetch the schedule");
 return res.data;
 },
 enabled: !!selectedGradeId,
 refetchOnWindowFocus: false,
 });

 const deleteMutation = useMutation({
 mutationFn: async (eventId) => {
 const { deleteScheduleEvent } =
 await import("@/app/actions/scheduleActions");
 return deleteScheduleEvent(eventId);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم حذف الموعد");
 queryClient.invalidateQueries({
 queryKey: ["scheduleEvents", selectedGradeId],
 });
 } else toast.error(res?.message || "فشل الحذف");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 const events = eventsQuery.data || [];

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiCalendar size={18} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 اختار صف عشان تشوف مواعيده
 </p>
 <p className="text-xs font-medium text-text-muted">
 المواعيد مرتبطة بصف معين
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
 <FiPlus size={14} /> إضافة موعد
 </button>
 </div>
 </div>

 {!selectedGradeId ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-navy text-white">
 <FiClock size={22} />
 </span>
 <p className="mt-4 text-base font-extrabold text-text-primary">
 اختار صف عشان تشوف مواعيده
 </p>
 <p className="mt-1 text-sm text-text-muted">
 المواعيد متقسمة حسب الصف — اختار واحد من اللي فوق.
 </p>
 </div>
 ) : eventsQuery.isLoading ? (
 <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
 <Spinner text="جاري التحميل..." />
 </div>
 ) : eventsQuery.isError ? (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 ">
 {eventsQuery.error?.message || "فشل تحميل المواعيد"}
 </div>
 ) : events.length === 0 ? (
 <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiCalendar size={20} />
 </span>
 <p className="mt-3 text-sm font-extrabold text-text-primary">
 لسه مفيش مواعيد في الصف ده
 </p>
 <p className="mt-1 text-xs text-text-muted">
 ابدأ بإضافة أول موعد بالتاريخ والوقت.
 </p>
 </div>
 ) : (
 <div className="grid gap-3">
 {events.map((ev) => {
 const start = new Date(ev.startAt);
 const end = ev.endAt ? new Date(ev.endAt) : null;
 return (
 <div
 key={ev._id}
 className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border) sm:flex-row sm:items-start sm:justify-between"
 >
 <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
 <div className="min-w-0 flex-1 pt-1">
 <div className="flex flex-wrap items-center gap-2">
 <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1 text-xs font-black text-white">
 <FiCalendar size={11} />
 {DAYS_AR[cairoWeekday(start)]}
 </span>
 <span
 className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-text-primary"
 dir="ltr"
 >
 {end
 ? `${formatCairo(start)} → ${cairoTimeKey(end)}`
 : formatCairo(start)}
 </span>
 <span className="rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy">
 {MODE_LABELS[ev.mode]}
 </span>
 {ev.recurrence?.type === "weekly" && (
 <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ">
 أسبوعي
 </span>
 )}
 </div>
 <p className="mt-2 text-sm font-extrabold text-text-primary">
 {ev.title}
 </p>
 {ev.mode === "offline" && ev.location?.name && (
 <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-text-muted">
 <FiMapPin size={11} />
 {ev.location.name}
 {ev.location.address ? ` — ${ev.location.address}` : ""}
 </p>
 )}
 {ev.mode === "online" && ev.onlineUrl && (
 <Link
 href={ev.onlineUrl}
 target="_blank"
 rel="noreferrer"
 className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-3 py-1 text-xs font-bold text-brand-navy hover:bg-brand-navy hover:text-white"
 dir="ltr"
 >
 <FiLink size={11} />
 {ev.onlineUrl}
 </Link>
 )}
 </div>
 <div className="flex shrink-0 items-center gap-1.5 self-start">
 <button
 type="button"
 onClick={() => {
 setEditing(ev);
 setFormOpen(true);
 }}
 className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy"
 >
 <FiEdit2 size={12} />
 </button>
 <button
 type="button"
 disabled={deleteMutation.isPending}
 onClick={() => {
 if (window.confirm(`حذف "${ev.title}" من المواعيد؟`))
 deleteMutation.mutate(ev._id);
 }}
 className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
 >
 <FiTrash2 size={14} />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

 <Modal
 isOpen={formOpen && !!selectedGradeId}
 onClose={() => {
 setFormOpen(false);
 setEditing(null);
 }}
 title={editing ? "تعديل الموعد" : "إضافة موعد"}
 >
 {selectedGradeId && (
 <EventForm
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
 }}
 />
 )}
 </Modal>
 </div>
 );
}
