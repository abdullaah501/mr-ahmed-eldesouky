"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../../lib/axios/axios";
import { getExams } from "@/app/actions/examActions";
import ExamCardAdmin from "./ExamCardAdmin";
import { FiPlus, FiBookOpen, FiLayers } from "react-icons/fi";

export default function SectionExams({ role }) {
 const queryClient = useQueryClient();
 const [selectedGrade, setSelectedGrade] = useState("");

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

 const queryKey = ["examsByGrade", selectedGrade];
 const { data, isLoading, isError } = useQuery({
 queryKey,
 queryFn: async () => {
 const res = await getExams(selectedGrade);
 if (!res.success) throw new Error(res.message || "Failed to fetch exams");
 return res.data || [];
 },
 enabled: !!selectedGrade,
 refetchOnWindowFocus: false,
 });

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiLayers size={18} />
 </span>
 <div>
 <h2 className="text-sm font-extrabold text-text-primary">
 اعمل اختبار جديد
 </h2>
 <p className="text-xs font-medium text-text-muted">
 كل اختبار تابع لصف
 </p>
 </div>
 </div>
 <Link
 href="/dashboard/exams/new"
 className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) shadow-sm"
 >
 <FiPlus size={16} /> إنشاء اختبار جديد
 </Link>
 </div>

 <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
 <div className="flex items-center gap-3">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiBookOpen size={16} />
 </span>
 <div className="flex-1">
 <p className="text-sm font-extrabold text-text-primary">الصف</p>
 <p className="text-xs font-medium text-text-muted">
 اختار الصف لعرض اختباراته
 </p>
 </div>
 <select
 value={selectedGrade}
 onChange={(e) => setSelectedGrade(e.target.value)}
 className="w-full max-w-xs rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
 >
 <option value="">اختار الصف</option>
 {(gradesQuery.data || []).map((g) => (
 <option key={g._id} value={g._id}>
 {g.name}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div>
 <h5 className="mb-3 flex items-center gap-2 text-base font-extrabold text-text-primary">
 <span className="h-5 w-1 rounded-full bg-brand-navy" />
 الاختبارات
 </h5>

 {!selectedGrade ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-navy text-white">
 <FiBookOpen size={20} />
 </span>
 <p className="mt-3 text-sm font-extrabold text-text-primary">
 اختار الصف لعرض اختباراته
 </p>
 <p className="mt-1 text-xs text-text-muted">
 الاختبارات منظمة حسب الصف
 </p>
 </div>
 ) : isLoading ? (
 <div className="flex justify-center py-12">
 <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent" />
 </div>
 ) : isError ? (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 ">
 خطأ في تحميل الاختبارات
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-4">
 {data?.length > 0 ? (
 data.map((exam) => (
 <ExamCardAdmin
 key={exam._id}
 exam={exam}
 queryClient={queryClient}
 queryKey={queryKey}
 />
 ))
 ) : (
 <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
 <p className="text-sm font-bold text-text-muted">
 لا توجد اختبارات بعد
 </p>
 <p className="mt-1 text-xs text-text-muted">
 ابدأ بإنشاء أول اختبار لهذا الصف
 </p>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
