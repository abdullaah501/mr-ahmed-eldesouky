"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../../../lib/axios/axios";
import { FiBookOpen } from "react-icons/fi";

/** Single scope adapter for grade-scoped exams. Assistants receive only
 * their GradeStaffAssignment grades (server-side source of truth); admins
 * get all active grades. addExam still enforces staff authorization. */
export default function GradeContextAdapter({
 onContextChange,
 value,
 role = "admin",
}) {
 const isAssistant = role === "assistant";
 const gradesQuery = useQuery({
 queryKey: isAssistant ? ["assistantGrades"] : ["activeGrades"],
 queryFn: async () => {
 if (isAssistant) {
 const { getMyGradesForAssistant } =
 await import("@/app/actions/staffActions");
 const res = await getMyGradesForAssistant();
 if (!res?.success)
 throw new Error(res?.message || "Failed to load grades");
 return res.data;
 }
 const res = await api.get("/api/grades");
 if (!res?.data?.success)
 throw new Error(res?.data?.message || "Failed to load grades");
 return res.data.data;
 },
 refetchOnWindowFocus: false,
 });

 return (
 <div className="flex items-center gap-3 flex-wrap">
 <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
 <FiBookOpen size={14} className="text-primary" /> الصف
 </span>
 <select
 value={value || ""}
 onChange={(e) => {
 const gradeId = e.target.value;
 onContextChange(
 gradeId ? { type: "grade", gradeId } : null,
 Boolean(gradeId),
 );
 }}
 disabled={(gradesQuery.data || []).length === 0}
 className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[220px]"
 >
 <option value="">اختار الصف</option>
 {(gradesQuery.data || []).map((g) => (
 <option key={g._id} value={g._id}>
 {g.name}
 </option>
 ))}
 </select>
 </div>
 );
}
