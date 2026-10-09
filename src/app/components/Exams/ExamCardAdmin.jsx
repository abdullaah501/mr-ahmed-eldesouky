"use client";

import toast from "react-hot-toast";
import { removeExam } from "@/app/actions/examActions";
import MemoizedModal from "../modal/Modal";
import { useState } from "react";
import { format } from "date-fns";
import EditExam from "./EditExam";
import {
 FiEdit,
 FiTrash2,
 FiEye,
 FiCalendar,
 FiBookOpen,
} from "react-icons/fi";
import ResultsByExam from "../analytics/ResultsByExam";

export default function ExamCardAdmin({ exam, queryClient, queryKey }) {
 const [isOpen, setIsOpen] = useState(false);
 const [viewModel, setViewModel] = useState(false);
 const [confirmDelete, setConfirmDelete] = useState(false);

 const handleDelete = async () => {
 const res = await removeExam(exam?._id);
 if (res.success) {
 queryClient.invalidateQueries(queryKey ? queryKey : ["examsByGrade"]);
 toast.success(res.message);
 } else toast.error(res.message);
 };

 return (
 <div className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border)">
 <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
 <div className="flex gap-3 pt-1">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border) shrink-0">
 <FiBookOpen size={18} />
 </span>
 <div>
 <div className="flex flex-wrap items-center gap-2">
 <h2 className="text-sm font-extrabold text-text-primary">
 {exam?.title || "اختبار"}
 </h2>
 {exam?._gradeName && (
 <span className="rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy">
 {exam._gradeName}
 </span>
 )}
 </div>
 <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-text-muted">
 <FiCalendar size={12} className="text-brand-navy" />
 {format(new Date(exam?.createdAt), "yyyy-MM-dd HH:mm")}
 </p>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => setViewModel(true)}
 className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy sm:flex-none"
 >
 <FiEye size={14} /> التفاصيل
 </button>
 <button
 type="button"
 onClick={() => setIsOpen(true)}
 className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-(--brand-navy-hover) sm:flex-none"
 >
 <FiEdit size={14} /> تعديل
 </button>
 <button
 type="button"
 onClick={() => setConfirmDelete(true)}
 className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 sm:flex-none"
 >
 <FiTrash2 size={14} /> حذف
 </button>
 </div>
 </div>

 <MemoizedModal isOpen={isOpen} onClose={() => setIsOpen(false)}>
 <EditExam exam={exam} queryClient={queryClient} />
 </MemoizedModal>

 <MemoizedModal
 isOpen={confirmDelete}
 onClose={() => setConfirmDelete(false)}
 title="تأكيد الحذف"
 >
 <div className="text-center">
 <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 border border-red-200 ">
 <FiTrash2 size={20} className="text-red-600" />
 </div>
 <h3 className="mt-4 text-base font-extrabold text-text-primary">
 هل أنت متأكد من حذف هذا الاختبار؟
 </h3>
 <p className="mt-1 text-sm text-text-muted">
 لا يمكن التراجع عن هذا الإجراء
 </p>
 <div className="mt-6 flex justify-center gap-3">
 <button
 onClick={() => {
 handleDelete();
 setConfirmDelete(false);
 }}
 className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700"
 >
 تأكيد الحذف
 </button>
 <button
 onClick={() => setConfirmDelete(false)}
 className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-bold text-text-secondary hover:bg-background"
 >
 إلغاء
 </button>
 </div>
 </div>
 </MemoizedModal>

 <MemoizedModal
 isOpen={viewModel}
 onClose={() => setViewModel(false)}
 title="النتائج"
 >
 <ResultsByExam examId={exam?._id} />
 </MemoizedModal>
 </div>
 );
}
