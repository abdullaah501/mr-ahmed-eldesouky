"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { api } from "../../../../lib/axios/axios";
import Modal from "../modal/Modal";
import {
 FiEdit2,
 FiTrash2,
 FiChevronLeft,
 FiChevronRight,
 FiBell,
} from "react-icons/fi";
import MathToolbar from "../math/MathToolbar";
import MathRenderer from "../math/MathRenderer";
import { useRef } from "react";

const TYPE_LABELS = {
 new_lecture: "محاضرة جديدة",
 new_exam: "امتحان جديد",
 exam_result: "نتيجة امتحان",
 schedule_change: "تغيير في المواعيد",
 attendance: "تحديث الحضور",
 announcement: "إعلان",
};
const inputCls =
 "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none";

export default function AdminNotificationsTable() {
 const queryClient = useQueryClient();
 const [page, setPage] = useState(1);
 const limit = 10;
 const [editTarget, setEditTarget] = useState(null);
 const [form, setForm] = useState({ title: "", body: "", link: "" });
 const editTitleRef = useRef(null);
 const editBodyRef = useRef(null);

 const listQuery = useQuery({
 queryKey: ["adminNotifications", page],
 queryFn: async () => {
 const res = await api.get(
 `/api/notifications/admin?page=${page}&limit=${limit}`,
 );
 if (!res?.data?.success)
 throw new Error(res?.data?.message || "Failed to fetch notifications");
 return res.data.data;
 },
 keepPreviousData: true,
 refetchOnWindowFocus: false,
 });

 const invalidate = () =>
 queryClient.invalidateQueries({ queryKey: ["adminNotifications"] });

 const updateMutation = useMutation({
 mutationFn: async () => {
 const res = await api.patch(
 `/api/notifications/admin/${editTarget.key}?grouped=${editTarget.grouped ? 1 : 0}`,
 { title: form.title.trim(), body: form.body, link: form.link.trim() },
 );
 if (!res?.data?.success)
 throw new Error(
 res?.data?.message || "فشل تحديث الإشعار",
 );
 return res.data;
 },
 onSuccess: () => {
 toast.success("تم تحديث الإشعار");
 setEditTarget(null);
 invalidate();
 },
 onError: (err) => toast.error(err?.message),
 });

 const deleteMutation = useMutation({
 mutationFn: async (row) => {
 const res = await api.delete(
 `/api/notifications/admin/${row.key}?grouped=${row.grouped ? 1 : 0}`,
 );
 if (!res?.data?.success)
 throw new Error(
 res?.data?.message || "فشل حذف الإشعار",
 );
 return res.data;
 },
 onSuccess: () => {
 toast.success("تم حذف الإشعار");
 invalidate();
 },
 onError: (err) => toast.error(err?.message),
 });

 function openEdit(row) {
 setEditTarget(row);
 setForm({ title: row.title, body: row.body || "", link: row.link || "" });
 }
 function submitEdit() {
 if (form.title.trim().length < 2) {
 toast.error("عنوان الإشعار مطلوب");
 return;
 }
 updateMutation.mutate();
 }

 const data = listQuery.data;
 const items = Array.isArray(data?.items) ? data.items : [];
 const total = data?.total || 0;
 const totalPages = Math.max(1, Math.ceil(total / limit));

 return (
 <div
 className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
 >
 <div className="mb-4 flex items-center gap-3">
 <span className="h-8 w-1 rounded-full bg-brand-navy" />
 <h2 className="text-base font-extrabold text-text-primary sm:text-lg">
 الإشعارات الحالية
 </h2>
 <span className="ms-auto rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-text-muted">
 {total} إشعار
 </span>
 </div>

 {listQuery.isLoading ? (
 <div className="rounded-xl border border-border bg-background py-12 text-center text-sm font-bold text-text-muted">
 جاري التحميل...
 </div>
 ) : listQuery.isError ? (
 <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700 ">
 {listQuery.error?.message || "خطأ في تحميل الإشعارات"}
 </div>
 ) : items.length === 0 ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-navy text-white">
 <FiBell size={20} />
 </span>
 <p className="mt-3 text-sm font-extrabold text-text-primary">
 لسه مفيش إشعارات محفوظة
 </p>
 <p className="mt-1 text-xs text-text-muted">
 كل الإشعارات المرسلة هتظهر هنا.
 </p>
 </div>
 ) : (
 <>
 <div className="overflow-hidden rounded-xl border border-border">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border bg-brand-navy-soft">
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 العنوان
 </th>
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 النوع
 </th>
 <th className="px-4 py-3 text-center text-xs font-extrabold tracking-wider text-brand-navy">
 المستلمون
 </th>
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 تاريخ الإنشاء
 </th>
 <th className="px-4 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 تنتهي في
 </th>
 <th className="px-4 py-3 text-center text-xs font-extrabold tracking-wider text-brand-navy">
 إجراءات
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {items.map((row) => (
 <tr
 key={row.key}
 className="transition-colors hover:bg-brand-navy-soft/40"
 >
 <td className="px-4 py-3">
 <div className="text-sm font-bold text-text-primary">
 <MathRenderer text={row.title} />
 </div>
 {row.body && (
 <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">
 <MathRenderer text={row.body} />
 </div>
 )}
 </td>
 <td className="px-4 py-3">
 <span className="rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy whitespace-nowrap">
 {TYPE_LABELS[row.type] || row.type}
 </span>
 </td>
 <td className="px-4 py-3 text-center text-sm font-bold text-text-primary whitespace-nowrap">
 {row.recipients}{" "}
 {row.recipients === 1 ? "طالب" : "طلاب"}
 </td>
 <td className="px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
 {format(new Date(row.createdAt), "yyyy-MM-dd HH:mm")}
 </td>
 <td className="px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
 {format(new Date(row.expiresAt), "yyyy-MM-dd")}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-center gap-1">
 <button
 type="button"
 onClick={() => openEdit(row)}
 className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-card text-text-muted hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy"
 aria-label="تعديل"
 >
 <FiEdit2 size={14} />
 </button>
 <button
 type="button"
 onClick={() => {
 if (
 window.confirm(
 "حذف الإشعار ده نهائياً؟ هيتمسح من عند كل المستلمين.",
 )
 )
 deleteMutation.mutate(row);
 }}
 className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 "
 aria-label="حذف"
 >
 <FiTrash2 size={14} />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 {totalPages > 1 && (
 <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:flex-row">
 <button
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={page === 1}
 className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40"
 >
 <FiChevronRight size={14} /> السابق
 </button>
 <span className="text-sm font-bold text-text-muted">
 صفحة <span className="text-brand-navy">{page}</span> من{" "}
 {totalPages}
 </span>
 <button
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40"
 >
 التالي <FiChevronLeft size={14} />
 </button>
 </div>
 )}
 </>
 )}

 <Modal
 isOpen={Boolean(editTarget)}
 onClose={() => setEditTarget(null)}
 title="تعديل الإشعار"
 >
 <div className="space-y-3 py-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 عنوان الإشعار <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
 </label>
 <MathToolbar inputRef={editTitleRef} targetValue={form.title} onChange={(v) => setForm({ ...form, title: v })} />
 <input
 ref={editTitleRef}
 value={form.title}
 onChange={(e) => setForm({ ...form, title: e.target.value })}
 placeholder="عنوان الإشعار — مثال: حل $\frac{1}{2}$"
 maxLength={120}
 className={`${inputCls} mt-2`}
 />
 {form.title && (
 <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
 <MathRenderer text={form.title} />
 </div>
 )}
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 محتوى الإشعار <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
 </label>
 <MathToolbar inputRef={editBodyRef} targetValue={form.body} onChange={(v) => setForm({ ...form, body: v })} />
 <textarea
 ref={editBodyRef}
 value={form.body}
 onChange={(e) => setForm({ ...form, body: e.target.value })}
 placeholder="محتوى الإشعار (اختياري) — مثال: $\sqrt{16}=4$"
 rows={3}
 maxLength={500}
 className={`${inputCls} mt-2`}
 />
 {form.body && (
 <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
 <MathRenderer text={form.body} />
 </div>
 )}
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 لينك داخلي
 </label>
 <input
 value={form.link}
 onChange={(e) => setForm({ ...form, link: e.target.value })}
 placeholder="لينك داخلي اختياري (/userDashboard)"
 dir="ltr"
 maxLength={300}
 className={`${inputCls} font-mono text-left`}
 style={{ direction: "ltr" }}
 />
 </div>
 <button
 type="button"
 onClick={submitEdit}
 disabled={updateMutation.isPending}
 className="w-full rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-50"
 >
 {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
 </button>
 </div>
 </Modal>
 </div>
 );
}
