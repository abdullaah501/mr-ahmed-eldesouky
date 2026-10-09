import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../../lib/axios/axios";
import Image from "next/image";
import React from "react";
import ExamResultsTable from "./ExamResultsTable";
import ExamAttemptDetailsModal from "./ExamAttemptDetailsModal";
import GuardianLinkCard from "../guardian/GuardianLinkCard";
import Spinner from "../ui/Spinner";
import { FiPhone, FiMail, FiMapPin, FiCalendar } from "react-icons/fi";

function StudentDetails({ student }) {
 const [activeTab, setActiveTab] = useState("analytics");
 const [currentPage, setCurrentPage] = useState(1);
 const [activeAttempt, setActiveAttempt] = useState(null);

 const imageUrl = student?.image?.cloudId;

 const { data, isLoading, isError, error } = useQuery({
 queryKey: ["examResults", currentPage, student?._id],
 queryFn: async () => {
 const res = await api.get(
 `/api/examsResults?limit=5&page=${currentPage}&studentId=${student?._id}`,
 );
 if (!res?.data?.success) {
 throw new Error(res?.data.message || "Failed to fetch exam results");
 }
 return res.data;
 },
 enabled: !!student?._id && activeTab === "analytics",
 keepPreviousData: true,
 refetchOnWindowFocus: false,
 });

 if (!student?._id) return null;

 if (isLoading && activeTab === "analytics")
 return <Spinner text="جاري تحميل البيانات..." />;
 if (isError && activeTab === "analytics")
 return (
 <div className="text-red-500 text-center p-4 bg-red-50 rounded-xl border border-red-200 ">
 خطأ: {error.message}
 </div>
 );

 const { data: examResults, pagination } = data || {};

 const handleExamResultClick = (result) => {
 if (!result?.examId) return;
 setActiveAttempt({
 examId: result.examId,
 meta: {
 studentName: `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
 studentEmail: student?.email || "",
 examTitle: result.examTitle || "",
 gradeName: result.gradeName || "",
 score: result.score || null,
 createdAt: result.createdAt || null,
 isCompleted: result.isCompleted,
 },
 });
 };

 const metaItems = [
 {
 icon: <FiCalendar size={13} />,
 label: "تاريخ التسجيل",
 value: new Date(student?.createdAt).toLocaleDateString("ar-EG"),
 },
 {
 icon: <FiPhone size={13} />,
 label: "رقم الموبايل",
 value: student?.phone,
 },
 {
 icon: <FiPhone size={13} />,
 label: "موبايل ولي الأمر",
 value: student?.guardianPhone,
 },
 {
 icon: <FiMapPin size={13} />,
 label: "المحافظة",
 value: student?.governorate,
 },
 {
 icon: <FiMail size={13} />,
 label: "البريد الإلكتروني",
 value: student?.email,
 full: true,
 },
 ];

 return (
 <div className="space-y-5">
 {/* ── Tabs ── */}
 <div className="flex gap-1 border-b border-foreground/10 mb-2">
 <button
 type="button"
 onClick={() => setActiveTab("analytics")}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
 activeTab === "analytics"
 ? "border-primary text-primary"
 : "border-transparent text-foreground/50 hover:text-foreground/70"
 }`}
 >
 تحليلات الطالب
 </button>
 <button
 type="button"
 onClick={() => setActiveTab("guardian")}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
 activeTab === "guardian"
 ? "border-primary text-primary"
 : "border-transparent text-foreground/50 hover:text-foreground/70"
 }`}
 >
 ولي الأمر
 </button>
 </div>

 {activeTab === "analytics" && (
 <>
 {/* ── Profile card ── */}
 <div className="bg-foreground/[0.03] border border-foreground/10 rounded-2xl p-5">
 <div className="flex items-center gap-4 mb-5">
 {imageUrl ? (
 <Image
 src={`/api/upload/proxyImage/${encodeURIComponent(imageUrl)}`}
 alt={student?.firstName + " " + student?.lastName}
 width={60}
 height={60}
 className="rounded-full aspect-square object-cover border-2 border-foreground/10 shadow"
 />
 ) : (
 <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 shadow">
 <span className="text-2xl font-bold text-primary">
 {student?.firstName?.charAt(0)}
 </span>
 </div>
 )}
 <div>
 <h3 className="text-lg font-bold text-foreground">
 {student?.firstName + " " + student?.lastName}
 </h3>
 <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-medium">
 {student?.grade}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {metaItems.map((item) => (
 <div
 key={item.label}
 className={`bg-background rounded-xl p-3 border border-foreground/8 ${item.full ? "sm:col-span-2" : ""}`}
 >
 <div className="flex items-center gap-1.5 text-foreground/40 mb-1">
 {item.icon}
 <span className="text-xs">{item.label}</span>
 </div>
 <span className="text-sm font-medium text-foreground">
 {item.value || "—"}
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* ── Exam results ── */}
 {examResults && (
 <ExamResultsTable
 examResults={examResults}
 pagination={pagination}
 currentPage={currentPage}
 onPageChange={setCurrentPage}
 onExamResultClick={handleExamResultClick}
 />
 )}
 </>
 )}

 {activeTab === "guardian" && (
 <GuardianLinkCard studentId={student?._id} />
 )}

 <ExamAttemptDetailsModal
 isOpen={!!activeAttempt}
 onClose={() => setActiveAttempt(null)}
 viewer="admin"
 studentId={student?._id}
 examId={activeAttempt?.examId}
 meta={activeAttempt?.meta}
 />
 </div>
 );
}

export default React.memo(StudentDetails, (prevProps, nextProps) => {
 return prevProps.student?._id === nextProps.student?._id;
});
