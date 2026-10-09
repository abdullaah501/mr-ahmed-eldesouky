"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { api } from "../../../../lib/axios/axios";
import Spinner from "../ui/Spinner";
import { FiCalendar, FiUsers, FiCheckCircle, FiClock } from "react-icons/fi";

const STATUS_OPTIONS = [
 {
 value: "present",
 label: "حاضر",
 cls: "text-emerald-700 border-emerald-200 bg-emerald-50 peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500 ",
 },
 {
 value: "late",
 label: "متأخر",
 cls: "text-amber-700 border-amber-200 bg-amber-50 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 ",
 },
 {
 value: "absent",
 label: "غائب",
 cls: "text-red-700 border-red-200 bg-red-50 peer-checked:bg-red-500 peer-checked:text-white peer-checked:border-red-500 ",
 },
];

function todayStr() {
 return format(new Date(), "yyyy-MM-dd");
}

export default function AttendanceSection({ role }) {
 const [gradeId, setGradeId] = useState("");
 const [date, setDate] = useState(todayStr());
 const [statuses, setStatuses] = useState({});
 const [recordId, setRecordId] = useState(null);

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

 const sessionQuery = useQuery({
 queryKey: ["attendanceSession", gradeId, date],
 queryFn: async () => {
 const { getAttendanceSession } =
 await import("@/app/actions/attendanceActions");
 const res = await getAttendanceSession(gradeId, date);
 if (!res?.success)
 throw new Error(res?.message || "Failed to load attendance sheet");
 return res.data;
 },
 enabled: !!gradeId && !!date,
 refetchOnWindowFocus: false,
 });

 // Re-sync local statuses whenever the session query delivers NEW data
 // (grade/date change or a post-save refetch). dataUpdatedAt in the key is
 // what lets a completed refetch win over the previous snapshot.
 const [loadedKey, setLoadedKey] = useState(null);
 const syncKey = `${gradeId}:${date}:${sessionQuery.dataUpdatedAt}`;
 if (sessionQuery.data && loadedKey !== syncKey) {
 setLoadedKey(syncKey);
 setStatuses(sessionQuery.data.statuses || {});
 setRecordId(sessionQuery.data.recordId);
 }

 const saveMutation = useMutation({
 mutationFn: async () => {
 const { saveAttendanceSession } =
 await import("@/app/actions/attendanceActions");
 const entries = Object.entries(statuses)
 .filter(([, s]) => s)
 .map(([studentId, status]) => ({ studentId, status }));
 if (entries.length === 0) throw new Error("مفيش حضور متسجل");
 return saveAttendanceSession({ gradeId, lectureId: null, date, entries });
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم حفظ كشف الحضور");
 // Keep the local statuses (they match what was just saved) and let
 // the refetch land silently — resetting loadedKey here would
 // re-sync from the STALE cached query and revert the UI.
 sessionQuery.refetch();
 } else toast.error(res?.message || "فشل الحفظ");
 },
 onError: (err) => toast.error(err?.message || "حصل خطأ غير متوقع"),
 });

 const roster = sessionQuery.data?.roster || [];
 const markedCount = Object.values(statuses).filter(Boolean).length;

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiUsers size={18} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 اختار الصف والتاريخ
 </p>
 <p className="text-xs font-medium text-text-muted">
 الكشف مرتبط بصف وتاريخ معين
 </p>
 </div>
 </div>
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
 <select
 value={gradeId}
 onChange={(e) => {
 setGradeId(e.target.value);
 setLoadedKey(null);
 setStatuses({});
 }}
 className="min-w-[200px] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
 >
 <option value="">اختار الصف</option>
 {(gradesQuery.data || []).map((g) => (
 <option key={g._id} value={g._id}>
 {g.name}
 </option>
 ))}
 </select>
 <div className="relative">
 <FiCalendar
 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
 size={14}
 />
 <input
 type="date"
 value={date}
 onChange={(e) => {
 setDate(e.target.value);
 setLoadedKey(null);
 }}
 className="rounded-xl border border-border bg-card py-2.5 pr-9 pl-4 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
 />
 </div>
 </div>
 </div>

 {!gradeId ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-navy text-white">
 <FiUsers size={22} />
 </span>
 <p className="mt-4 text-base font-extrabold text-text-primary">
 اختار صف عشان تشوف طلبته
 </p>
 <p className="mt-1 text-sm text-text-muted">
 كشف الحضور بيظهر بعد اختيار الصف والتاريخ.
 </p>
 </div>
 ) : sessionQuery.isLoading ? (
 <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
 <Spinner text="جاري تحميل الكشف..." />
 </div>
 ) : sessionQuery.isError ? (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 ">
 {sessionQuery.error?.message || "فشل التحميل"}
 </div>
 ) : roster.length === 0 ? (
 <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
 <p className="text-sm font-extrabold text-text-primary">
 مفيش طلبة في الصف ده
 </p>
 <p className="mt-1 text-xs text-text-muted">
 اتأكد إن الطلبة مسجلين في الصف ده الأول.
 </p>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-2">
 <span
 className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${recordId ? "border-amber-200 bg-amber-50 text-amber-700 " : "border-(--brand-navy-border) bg-brand-navy-soft text-brand-navy"}`}
 >
 {recordId ? <FiClock size={12} /> : <FiCheckCircle size={12} />}{" "}
 {recordId ? "تعديل كشف محفوظ" : "كشف جديد"}
 </span>
 <span className="text-sm font-bold text-text-primary">
 {markedCount}/{roster.length}{" "}
 <span className="font-medium text-text-muted">متسجل</span>
 </span>
 </div>
 <button
 type="button"
 onClick={() => saveMutation.mutate()}
 disabled={saveMutation.isPending || markedCount === 0}
 className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-40"
 >
 {saveMutation.isPending
 ? "جاري الحفظ..."
 : recordId
 ? "تحديث الكشف"
 : "حفظ الكشف"}
 </button>
 </div>

 <div className="grid gap-2">
 {roster.map((s) => (
 <div
 key={s.studentId}
 className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-(--brand-navy-border) hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
 >
 <span className="text-sm font-bold text-text-primary">
 {s.name}
 </span>
 <div className="flex gap-1.5">
 {STATUS_OPTIONS.map((opt) => (
 <label key={opt.value} className="cursor-pointer">
 <input
 type="radio"
 name={`att-${s.studentId}`}
 value={opt.value}
 checked={statuses[s.studentId] === opt.value}
 onChange={() =>
 setStatuses((p) => ({
 ...p,
 [s.studentId]: opt.value,
 }))
 }
 className="peer sr-only"
 />
 <span
 className={`inline-flex min-w-[56px] justify-center rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${opt.cls}`}
 >
 {opt.label}
 </span>
 </label>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}
