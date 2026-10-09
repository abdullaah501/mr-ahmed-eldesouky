"use client";
import EssayCard from "./EssayCard";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../lib/axios/axios";
import toast from "react-hot-toast";
import Spinner from "../ui/Spinner";
import { FiFileText, FiChevronRight, FiChevronLeft } from "react-icons/fi";

export default function EssaysSection({ adminId }) {
 const [currentPage, setCurrentPage] = useState(1);
 const queryClient = useQueryClient();
 const { data, isLoading, isError } = useQuery({
 queryKey: ["essays", currentPage],
 queryFn: async () => {
 const res = await api.get(
 adminId
 ? `/api/getEssays?limit=5&page=${currentPage}&adminId=${adminId}`
 : `/api/getEssays?limit=5&page=${currentPage}`,
 );
 if (!res?.data?.success)
 throw new Error(res?.data.message || "فشل تحميل المقالات");
 return res.data;
 },
 enabled: !!currentPage,
 keepPreviousData: true,
 refetchOnWindowFocus: false,
 });

 useEffect(() => {
 const evtSource = new EventSource("/api/stream/essayMessages");
 evtSource.onmessage = (event) => {
 const newMsg = JSON.parse(event.data);
 if (!newMsg) return;
 toast.success("وصلت إجابة مقالية جديدة!");
 queryClient.invalidateQueries(["essays", currentPage]);
 };
 evtSource.onerror = () => evtSource.close();
 return () => evtSource.close();
 }, [currentPage, queryClient]);

 if (isLoading)
 return (
 <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
 <Spinner text="جاري تحميل الأسئلة المقالية..." />
 </div>
 );
 if (isError)
 return (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 ">
 فشل تحميل البيانات
 </div>
 );

 const { data: essays, pagination } = data;
 const handlePrevious = () => {
 if (currentPage > 1) setCurrentPage((p) => p - 1);
 };
 const handleNext = () => {
 if (currentPage < (pagination?.totalPages || 1))
 setCurrentPage((p) => p + 1);
 };

 return (
 <>
 <div className="grid gap-4">
 {essays.length > 0 ? (
 essays.map((essay) => (
 <EssayCard
 key={essay._id}
 essay={essay}
 queryClient={queryClient}
 currentPage={currentPage}
 />
 ))
 ) : (
 <div className="rounded-3xl border border-dashed border-(--brand-navy-border) bg-brand-navy-soft/30 p-10 text-center">
 <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-navy text-white">
 <FiFileText size={20} />
 </span>
 <p className="mt-3 text-sm font-extrabold text-text-primary">
 مفيش مقالات محتاجة تصحيح دلوقتي
 </p>
 <p className="mt-1 text-xs text-text-muted">
 إجابات الطلبة المقالية هتظهر هنا أول ما يبعتوها.
 </p>
 </div>
 )}
 </div>
 {pagination?.totalPages > 1 && (
 <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
 <button
 onClick={handlePrevious}
 disabled={currentPage === 1}
 className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40 disabled:cursor-not-allowed"
 >
 <FiChevronRight size={14} /> السابق
 </button>
 <span className="text-sm font-bold text-text-muted">
 صفحة <span className="text-brand-navy">{currentPage}</span> من{" "}
 {pagination.totalPages}
 </span>
 <button
 onClick={handleNext}
 disabled={currentPage >= data.pagination.totalPages}
 className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40 disabled:cursor-not-allowed"
 >
 التالي <FiChevronLeft size={14} />
 </button>
 </div>
 )}
 </>
 );
}
