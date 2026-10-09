"use client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { api } from "../../../../lib/axios/axios";
import Modal from "../modal/Modal";
import StudentDetails from "./StudentDetails";
import { format } from "date-fns";
import Spinner from "../ui/Spinner";
import debounce from "../../../../lib/debounce";
import {
 FiUsers,
 FiChevronLeft,
 FiChevronRight,
 FiSearch,
} from "react-icons/fi";

export default function StudentsAnalyticsSection() {
 const [currentPage, setCurrentPage] = useState(1);
 const [configModal, setConfigModal] = useState({
 isOpen: false,
 currentUser: null,
 });
 const [searchInput, setSearchInput] = useState("");
 const [debouncedSearch, setDebouncedSearch] = useState("");

 const updateDebouncedSearch = useMemo(
 () => debounce((v) => setDebouncedSearch(v), 700),
 [],
 );
 useEffect(() => {
 setCurrentPage(1);
 }, [debouncedSearch]);

 const { data, isLoading, isError, error } = useQuery({
 queryKey: ["students", currentPage, debouncedSearch],
 queryFn: async () => {
 const res = await api.get(
 `/api/getStudents?limit=5&page=${currentPage}&search=${encodeURIComponent(debouncedSearch)}`,
 );
 if (!res?.data?.success)
 throw new Error(res?.data.message || "Failed to fetch students");
 return res.data;
 },
 enabled: !!currentPage,
 keepPreviousData: true,
 refetchOnWindowFocus: false,
 });

 if (isLoading)
 return (
 <div className="mt-8">
 <Spinner text="جاري تحميل الطلبة..." />
 </div>
 );
 if (isError)
 return (
 <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 ">
 خطأ: {error.message}
 </div>
 );

 const { data: students, pagination } = data;

 return (
 <div className="mt-8">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
 <div className="flex items-center gap-3">
 <span className="h-8 w-1 rounded-full bg-brand-navy" />
 <div>
 <h2 className="text-xl font-extrabold text-text-primary sm:text-2xl">
 الطلبة المسجلون
 </h2>
 <p className="text-xs font-semibold text-text-muted">
 دوّر وتابع تفاصيل كل طالب
 </p>
 </div>
 </div>
 <div className="inline-flex items-center gap-2 self-start rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-4 py-2 sm:self-auto">
 <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-navy text-white text-xs font-black">
 <FiUsers size={12} />
 </span>
 <div className="text-right">
 <p className="text-xs font-bold text-brand-navy">إجمالي الطلبة</p>
 <p className="text-sm font-black text-brand-navy">
 {pagination?.totalStudents ?? 0}
 </p>
 </div>
 </div>
 </div>

 <div className="relative mt-6 max-w-md">
 <FiSearch
 className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted"
 size={16}
 />
 <input
 type="text"
 value={searchInput}
 onChange={(e) => {
 setSearchInput(e.target.value);
 updateDebouncedSearch(e.target.value);
 }}
 placeholder="دوّر بالاسم أو البريد أو الصف..."
 className="w-full rounded-xl border border-border bg-card py-3 pr-10 pl-4 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
 />
 </div>

 {students.length === 0 ? (
 <div className="mt-6 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
 <p className="text-sm font-bold text-text-primary">
 مفيش طلبة مطابقة لبحثك
 </p>
 <p className="mt-1 text-xs text-text-muted">جرّب كلمات مختلفة</p>
 </div>
 ) : (
 <>
 <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:block">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border bg-brand-navy-soft">
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 الطالب
 </th>
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 الصف
 </th>
 <th className="px-5 py-3 text-right text-xs font-extrabold tracking-wider text-brand-navy">
 تاريخ التسجيل
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {students.map((s) => (
 <tr
 key={s._id || s.email}
 className="cursor-pointer transition-colors hover:bg-brand-navy-soft/40"
 onClick={() =>
 setConfigModal({ isOpen: true, currentUser: s })
 }
 >
 <td className="px-5 py-4">
 <div className="flex items-center gap-3">
 <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border) text-sm font-black">
 {s.firstName?.charAt(0) || "?"}
 </span>
 <div>
 <p className="text-sm font-bold text-text-primary">
 {s.firstName} {s.lastName}
 </p>
 <p className="text-xs text-text-muted">{s.email}</p>
 </div>
 </div>
 </td>
 <td className="px-5 py-4">
 <span className="rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy">
 {s.grade || "—"}
 </span>
 </td>
 <td className="px-5 py-4 text-xs font-medium text-text-muted whitespace-nowrap">
 {format(new Date(s.createdAt), "yyyy-MM-dd HH:mm")}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="mt-6 grid gap-3 sm:hidden">
 {students.map((s) => (
 <div
 key={s._id || s.email}
 onClick={() => setConfigModal({ isOpen: true, currentUser: s })}
 className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-(--brand-navy-border)"
 >
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border) text-sm font-black">
 {s.firstName?.charAt(0) || "?"}
 </span>
 <div>
 <p className="text-sm font-bold text-text-primary">
 {s.firstName} {s.lastName}
 </p>
 <p className="max-w-[170px] truncate text-xs text-text-muted">
 {s.email}
 </p>
 </div>
 </div>
 <span className="shrink-0 rounded-full border border-(--brand-navy-border) bg-brand-navy-soft px-2.5 py-1 text-xs font-bold text-brand-navy">
 {s.grade || "—"}
 </span>
 </div>
 <div className="mt-3 border-t border-border pt-3 text-xs font-medium text-text-muted">
 {format(new Date(s.createdAt), "yyyy-MM-dd HH:mm")}
 </div>
 </div>
 ))}
 </div>
 </>
 )}

 {pagination?.totalPages > 1 && (
 <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <button
 onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
 disabled={pagination.currentPage === 1}
 className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40 disabled:cursor-not-allowed"
 >
 <FiChevronRight size={14} /> السابق
 </button>
 <span className="text-center text-sm font-medium text-text-muted">
 صفحة{" "}
 <span className="font-black text-brand-navy">
 {pagination.currentPage}
 </span>{" "}
 من{" "}
 <span className="font-black text-text-primary">
 {pagination.totalPages}
 </span>
 </span>
 <button
 onClick={() =>
 setCurrentPage((p) => (p < pagination.totalPages ? p + 1 : p))
 }
 disabled={pagination.currentPage === pagination.totalPages}
 className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-text-primary hover:bg-brand-navy-soft hover:border-(--brand-navy-border) hover:text-brand-navy disabled:opacity-40 disabled:cursor-not-allowed"
 >
 التالي <FiChevronLeft size={14} />
 </button>
 </div>
 )}

 <Modal
 isOpen={configModal.isOpen}
 onClose={() => setConfigModal({ isOpen: false, currentUser: null })}
 title="تفاصيل الطالب"
 >
 <div className="max-h-[70vh] overflow-y-auto px-1 py-2">
 <StudentDetails student={configModal.currentUser} />
 </div>
 </Modal>
 </div>
 );
}
