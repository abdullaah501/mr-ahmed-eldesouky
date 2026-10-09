"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../../../../lib/axios/axios";
import {
 FiPlus,
 FiTrash2,
 FiPower,
 FiBookOpen,
 FiLayers,
} from "react-icons/fi";
import Modal from "../modal/Modal";
import PrimaryButton from "../ui/PrimaryButton";

export default function GradesSection() {
 const queryClient = useQueryClient();
 const [showAdd, setShowAdd] = useState(false);
 const [nameInput, setNameInput] = useState("");

 const gradesQuery = useQuery({
 queryKey: ["grades", "all"],
 queryFn: async () => {
 const res = await api.get("/api/grades?all=1");
 return res.data?.data ?? [];
 },
 });

 const invalidate = () => {
 queryClient.invalidateQueries({ queryKey: ["grades"] });
 queryClient.invalidateQueries({ queryKey: ["activeGrades"] });
 };

 const createMutation = useMutation({
 mutationFn: async ({ name }) => {
 const { createGrade } = await import("@/app/actions/gradeActions");
 return createGrade({ name });
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم إنشاء الصف الدراسي");
 setShowAdd(false);
 setNameInput("");
 invalidate();
 } else toast.error(res?.message || "فشل إنشاء الصف الدراسي");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 const updateMutation = useMutation({
 mutationFn: async (patch) => {
 const { updateGrade } = await import("@/app/actions/gradeActions");
 return updateGrade(patch);
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
 mutationFn: async (gradeId) => {
 const { removeGrade } = await import("@/app/actions/gradeActions");
 return removeGrade(gradeId);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم حذف الصف الدراسي");
 invalidate();
 } else toast.error(res?.message || "فشل الحذف");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 const submitCreate = () => createMutation.mutate({ name: nameInput });
 const toggleActive = (g) =>
 updateMutation.mutate({ gradeId: g._id, active: !g.active });
 const busy =
 createMutation.isPending ||
 updateMutation.isPending ||
 removeMutation.isPending;

 return (
 <div className="space-y-6">
 {/* Toolbar */}
 <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiLayers size={18} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 إدارة الصفوف الدراسية
 </p>
 <p className="text-xs font-medium text-text-muted">
 الصفوف هي الوحدة الأساسية — كل محاضرة وامتحان تابع لصف معين
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3 self-start sm:self-auto">
 <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-nowrap border border-border bg-background px-3 py-1.5 text-xs font-bold text-text-muted">
 {gradesQuery.data?.length ?? 0} صف
 </span>
 <PrimaryButton onClick={() => setShowAdd(true)} disabled={busy}>
 <span className="inline-flex items-center gap-2">
 <FiPlus size={16} /> صف جديد
 </span>
 </PrimaryButton>
 </div>
 </div>

 {gradesQuery.isLoading ? (
 <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
 <p className="text-sm font-bold text-text-muted">جاري تحميل الصفوف...</p>
 </div>
 ) : gradesQuery.isError ? (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 ">
 فشل تحميل الصفوف
 </div>
 ) : gradesQuery?.data?.length === 0 ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/40 p-10 text-center">
 <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-navy text-white">
 <FiBookOpen size={22} />
 </span>
 <p className="mt-4 text-base font-extrabold text-text-primary">
 لسه مفيش صفوف
 </p>
 <p className="mt-1 text-sm text-text-muted">
 ضيف أول صف عشان تبدأ — مثال: الصف الأول الثانوي
 </p>
 <div className="mt-6 flex justify-center">
 <PrimaryButton onClick={() => setShowAdd(true)}>
 <FiPlus /> إنشاء صف
 </PrimaryButton>
 </div>
 </div>
 ) : (
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {gradesQuery.data.map((grade) => (
 <div
 key={grade._id}
 className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border)"
 >
 <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
 <div className="p-5">
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiBookOpen size={18} />
 </span>
 <h6 className="text-sm font-extrabold leading-tight text-text-primary line-clamp-2">
 {grade.name}
 </h6>
 </div>
 <span
 className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${grade.active ? "bg-emerald-50 border-emerald-200 text-emerald-700 " : "bg-gray-50 border-gray-200 text-gray-600 "}`}
 >
 {grade.active ? (
 <>
 <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
 نشط
 </>
 ) : (
 <>
 <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full border border-gray-400" />
 غير نشط
 </>
 )}
 </span>
 </div>
 </div>
 <div className="mt-auto flex gap-2 border-t border-border bg-background/60 p-3">
 <button
 onClick={() => toggleActive(grade)}
 disabled={busy}
 className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${grade.active ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 " : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 "}`}
 >
 <FiPower size={13} />{" "}
 {grade.active ? "تعطيل" : "تفعيل"}
 </button>
 <button
 onClick={() => {
 if (
 window.confirm(
 `حذف الصف "${grade.name}"؟ مسموح فقط لو مش مرتبط بأي محتوى.`,
 )
 )
 removeMutation.mutate(grade._id);
 }}
 disabled={busy}
 className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
 aria-label="حذف"
 >
 <FiTrash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 <Modal
 isOpen={showAdd}
 onClose={() => {
 setShowAdd(false);
 }}
 >
 <div className="space-y-4">
 <div className="flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white">
 <FiBookOpen size={18} />
 </span>
 <div>
 <h6 className="text-base font-extrabold text-text-primary">
 صف جديد
 </h6>
 <p className="text-xs font-medium text-text-muted">
 مثال: الصف الأول الثانوي
 </p>
 </div>
 </div>
 <input
 value={nameInput}
 onChange={(e) => setNameInput(e.target.value)}
 placeholder="اسم الصف"
 maxLength={100}
 className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
 />
 <div className="flex justify-end gap-2">
 <button
 onClick={() => {
 setShowAdd(false);
 }}
 className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-secondary hover:bg-background"
 >
 إلغاء
 </button>
 <PrimaryButton
 onClick={submitCreate}
 disabled={nameInput.trim().length < 2 || createMutation.isPending}
 >
 {createMutation.isPending ? "جاري التنفيذ..." : "إنشاء"}
 </PrimaryButton>
 </div>
 </div>
 </Modal>
 </div>
 );
}
