"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../lib/axios/axios";
import debounce from "../../../../lib/debounce";
import { FiSearch, FiX } from "react-icons/fi";

/**
 * Registered-student picker for the notification composer.
 * Reuses the existing Overview student search: same /api/getStudents
 * endpoint, same debounce utility and delay, same result structure.
 * The teacher never types a student ID — the selected student's _id is
 * kept internally and handed to onChange.
 *
 * excludeAdmins: searches all registered non-admin users instead of only
 * students (used by the assistant assignment selector).
 */
export default function StudentSearchSelect({
 value,
 onChange,
 excludeAdmins = false,
 showRole = false,
}) {
 const [searchInput, setSearchInput] = useState("");
 const [debouncedSearch, setDebouncedSearch] = useState("");

 const updateDebouncedSearch = useMemo(
 () => debounce((v) => setDebouncedSearch(v), 700),
 [],
 );

 const { data, isLoading, isError } = useQuery({
 queryKey: ["studentSearch", debouncedSearch],
 queryFn: async () => {
 const res = await api.get(
 `/api/getStudents?limit=5&${excludeAdmins ? "excludeAdmins=1&" : ""}search=${encodeURIComponent(debouncedSearch)}`,
 );
 if (!res?.data?.success) {
 throw new Error(res?.data?.message || "Failed to fetch students");
 }
 return res.data;
 },
 enabled: !value,
 keepPreviousData: true,
 refetchOnWindowFocus: false,
 });

 const students = data?.data || [];

 if (value) {
 return (
 <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
 <span className="text-sm font-bold text-primary">
 {value.firstName?.charAt(0)}
 </span>
 </div>
 <div className="min-w-0">
 <p className="font-medium text-foreground text-sm truncate">
 {value.firstName + " " + value.lastName}
 </p>
 <p className="text-xs text-foreground/50 truncate">{value.email}</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => {
 setSearchInput("");
 setDebouncedSearch("");
 onChange(null);
 }}
 className="p-1.5 rounded-lg text-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
 aria-label="إزالة الطالب"
 >
 <FiX size={16} />
 </button>
 </div>
 );
 }

 return (
 <div className="space-y-2">
 <div className="relative">
 <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40" />
 <input
 type="text"
 value={searchInput}
 onChange={(e) => {
 setSearchInput(e.target.value);
 updateDebouncedSearch(e.target.value);
 }}
 placeholder="دوّر على طالب..."
 className="w-full pr-9 pl-3 py-2.5 bg-background border border-foreground/10 rounded-xl text-sm focus:outline-none focus:border-primary "
 />
 </div>

 {isLoading || data === undefined ? (
 <div className="text-center py-3 text-sm text-foreground/50 border border-dashed border-foreground/10 rounded-xl">
 جاري البحث...
 </div>
 ) : isError ? (
 <div className="text-center py-3 text-sm text-red-500 border border-dashed border-red-300 rounded-xl">
 حصل خطأ أثناء البحث
 </div>
 ) : students.length === 0 ? (
 <div className="text-center py-3 text-sm text-foreground/50 border border-dashed border-foreground/10 rounded-xl">
 مفيش طلبة مطابقة لبحثك
 </div>
 ) : (
 <div className="divide-y divide-foreground/5 border border-foreground/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
 {students.map((student) => (
 <button
 type="button"
 key={student._id}
 onClick={() => onChange(student)}
 className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-foreground/[0.03] transition-colors"
 >
 <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
 <span className="text-sm font-bold text-primary">
 {student.firstName?.charAt(0)}
 </span>
 </div>
 <div className="min-w-0 flex-1">
 <p className="font-medium text-foreground text-sm truncate">
 {student.firstName + " " + student.lastName}
 </p>
 <p className="text-xs text-foreground/50 truncate">
 {student.email}
 </p>
 </div>
 <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0">
 {showRole
 ? student.role === "assistant"
 ? "مساعد"
 : "طالب"
 : student.grade}
 </span>
 </button>
 ))}
 </div>
 )}
 </div>
 );
}
