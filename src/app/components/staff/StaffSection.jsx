"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
 FiPlus,
 FiTrash2,
 FiUsers,
 FiUserCheck,
 FiBookOpen,
} from "react-icons/fi";
import StudentSearchSelect from "../notifications/StudentSearchSelect";

function AssignmentForm({ onDone }) {
 const queryClient = useQueryClient();
 const [selectedUser, setSelectedUser] = useState(null);
 const [gradeId, setGradeId] = useState("");

 const gradesQuery = useQuery({
 queryKey: ["activeGrades"],
 queryFn: async () => {
 const { api } = await import("../../../../lib/axios/axios");
 const res = await api.get("/api/grades");
 if (!res?.data?.success)
 throw new Error(res?.data?.message || "Failed to fetch grades");
 return res.data.data;
 },
 refetchOnWindowFocus: false,
 });

 const mutation = useMutation({
 mutationFn: async () => {
 const { addStaffMember } = await import("@/app/actions/staffActions");
 return addStaffMember({ assistantId: selectedUser?._id, gradeId });
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success(res?.message || "تمت إضافة التعيين");
 setSelectedUser(null);
 setGradeId("");
 queryClient.invalidateQueries({ queryKey: ["staffAssignments"] });
 onDone?.();
 } else toast.error(res?.message || "فشل التعيين");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 return (
 <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
 <div className="mb-4 flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiUserCheck size={18} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 تعيين مساعد جديد
 </p>
 <p className="text-xs font-medium text-text-muted">
 اختار المستخدم والصف، وبعدين دوس تعيين
 </p>
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 اختار مستخدم (طالب أو مساعد)
 </label>
 <StudentSearchSelect
 value={selectedUser}
 onChange={setSelectedUser}
 excludeAdmins
 showRole
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
 الصف
 </label>
 <select
 value={gradeId}
 onChange={(e) => setGradeId(e.target.value)}
 className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
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
 <div className="mt-4 flex justify-start">
 <button
 type="button"
 onClick={() => mutation.mutate()}
 disabled={mutation.isPending || !selectedUser?._id || !gradeId}
 className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-40"
 >
 <FiPlus size={14} />{" "}
 {mutation.isPending ? "جاري التنفيذ..." : "تعيين"}
 </button>
 </div>
 </div>
 );
}

export default function StaffSection() {
 const queryClient = useQueryClient();
 const assignmentsQuery = useQuery({
 queryKey: ["staffAssignments"],
 queryFn: async () => {
 const { getStaffAssignments } =
 await import("@/app/actions/staffActions");
 const res = await getStaffAssignments();
 if (!res?.success) throw new Error(res?.message || "Failed to fetch assignments");
 return res.data;
 },
 refetchOnWindowFocus: false,
 });

 const removeMutation = useMutation({
 mutationFn: async (assignmentId) => {
 const { removeStaffMember } = await import("@/app/actions/staffActions");
 return removeStaffMember(assignmentId);
 },
 onSuccess: (res) => {
 if (res?.success) {
 toast.success("تم حذف التعيين");
 queryClient.invalidateQueries({ queryKey: ["staffAssignments"] });
 } else toast.error(res?.message || "فشل الحذف");
 },
 onError: () => toast.error("حصل خطأ غير متوقع"),
 });

 return (
 <div className="space-y-6">
 <AssignmentForm />

 <div className="flex items-center gap-3">
 <span className="h-6 w-1 rounded-full bg-brand-navy" />
 <h3 className="text-sm font-extrabold text-text-primary">
 التعيينات الحالية
 </h3>
 <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-text-muted">
 {assignmentsQuery.data?.length ?? 0} تعيين
 </span>
 </div>

 {assignmentsQuery.isLoading ? (
 <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
 <p className="text-sm font-bold text-text-muted">جاري التحميل...</p>
 </div>
 ) : (assignmentsQuery.data || []).length === 0 ? (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-navy text-white">
 <FiUsers size={20} />
 </span>
 <p className="mt-3 text-sm font-extrabold text-text-primary">
 لسه مفيش تعيينات
 </p>
 <p className="mt-1 text-xs text-text-muted">
 عيّن أول مساعد لصف باستخدام النموذج اللي فوق.
 </p>
 </div>
 ) : (
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {assignmentsQuery.data.map((a) => (
 <div
 key={a._id}
 className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border)"
 >
 <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
 <div className="flex items-start justify-between gap-3 pt-1">
 <div className="flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
 <FiUserCheck size={16} />
 </span>
 <div>
 <p className="text-sm font-extrabold text-text-primary">
 {a.assistantId
 ? `${a.assistantId.firstName} ${a.assistantId.lastName || ""}`.trim()
 : "—"}
 </p>
 <p className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-2 py-0.5 text-xs font-bold text-brand-navy">
 <FiBookOpen size={10} />
 {a.gradeId?.name || "صف محذوف"}
 </p>
 </div>
 </div>
 <button
 type="button"
 disabled={removeMutation.isPending}
 onClick={() => {
 if (window.confirm("حذف التعيين ده؟"))
 removeMutation.mutate(a._id);
 }}
 className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
 aria-label="حذف"
 >
 <FiTrash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
