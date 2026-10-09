import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiUsers, FiCheckCircle, FiXCircle, FiAward, FiAlertCircle } from 'react-icons/fi';
import { LuCheck, LuX } from 'react-icons/lu';
import { api } from '../../../../lib/axios/axios';
import React from 'react';
import Image from "next/image";

const SCORE_CSS = {
 high: 'text-emerald-700 bg-emerald-50 border-emerald-200 ',
 mid: 'text-amber-700 bg-amber-50 border-amber-200 ',
 low: 'text-red-700 bg-red-50 border-red-200 ',
};
const getScoreClass = (pct) => {
 if (pct >= 80) return SCORE_CSS.high;
 if (pct >= 60) return SCORE_CSS.mid;
 return SCORE_CSS.low;
};

const StudentRow = React.memo(function StudentRow({ student, submission }) {
 const correct = submission?.score?.correct || 0;
 const wrong = submission?.score?.wrong || 0;
 const totalQ = correct + wrong;
 const pct = totalQ ? Math.round((correct / totalQ) * 100) : 0;
 const dateStr = submission?.createdAt ? new Date(submission.createdAt).toLocaleDateString('en-GB') : '';
 return (
 <div className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--brand-navy-border)]">
 <div className="flex items-center gap-3 min-w-0">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] border border-[var(--brand-navy-border)] text-sm font-black shrink-0">{student?.firstName?.charAt(0) || "?"}</span>
 <div className="min-w-0">
 <p className="truncate text-sm font-bold text-[var(--text-primary)]">{student?.firstName} {student?.lastName}</p>
 <p className="truncate text-xs text-[var(--text-muted)]">{student?.email}</p>
 </div>
 </div>
 {submission ? (
 <div className="shrink-0 text-right">
 <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getScoreClass(pct)}`}>
 {correct} <LuCheck size={12} className="inline" /> / {wrong} <LuX size={12} className="inline" /> <span className="opacity-70">{pct}%</span>
 </span>
 {dateStr && <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{dateStr}</p>}
 </div>
 ) : (
 <span className="rounded-full border border-border bg-[var(--background)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">غائب</span>
 )}
 </div>
 );
});

export default function ResultsByExam({ examId }) {
 const [showNotSubmitted, setShowNotSubmitted] = useState(false);
 const { data, isLoading, isError, error } = useQuery({
 queryKey: ["examResults", examId],
 queryFn: async () => {
 const res = await api.get(`/api/usersExamsResults/${examId}`);
 const d = res.data;
 if (!d?.success) throw new Error(d?.message || 'Failed to load data');
 return d;
 },
 enabled: !!examId,
 staleTime: 30_000,
 gcTime: 5 * 60 * 1000,
 refetchOnWindowFocus: false,
 refetchOnReconnect: false,
 retry: (failureCount, error) => {
 const status = error?.response?.status;
 if (status >= 400 && status < 500) return false;
 return failureCount < 2;
 },
 });

 if (isLoading) {
 return <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 shadow-sm"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--brand-navy)] border-t-transparent" /></div>;
 }
 if (isError) {
 return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700 ">خطأ: {error?.response?.data?.message || error?.message || 'حصل خطأ'}</div>;
 }
 if (!data) {
 return <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 shadow-sm"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--brand-navy)] border-t-transparent" /></div>;
 }

 const { stats, studentsWhoSubmitted, studentsNotSubmitted = [], mode } = data;
 const isPaid = mode === 'paid';

 return (
 <div className="space-y-4">
 <div className={`grid ${isPaid ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
 <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)] p-4">
 <div className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-navy)]" />
 <div className="flex items-center gap-2 pt-1">
 <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand-navy)] text-white"><FiUsers size={14} /></span>
 <span className="text-xs font-extrabold text-[var(--brand-navy)]">{isPaid ? 'إجمالي المشتركين' : 'الطلبة اللي امتحنوا'}</span>
 </div>
 <p className="mt-2 text-2xl font-black text-[var(--brand-navy)]">{stats.total}</p>
 </div>
 <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ">
 <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
 <div className="flex items-center gap-2 pt-1 text-emerald-700 ">
 <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-white"><FiCheckCircle size={14} /></span>
 <span className="text-xs font-extrabold">حضروا</span>
 </div>
 <p className="mt-2 text-2xl font-black text-emerald-700 ">{stats.submitted}</p>
 </div>
 {isPaid && (
 <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-4 ">
 <div className="absolute inset-x-0 top-0 h-1 bg-red-500" />
 <div className="flex items-center gap-2 pt-1 text-red-700 ">
 <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500 text-white"><FiXCircle size={14} /></span>
 <span className="text-xs font-extrabold">غابوا</span>
 </div>
 <p className="mt-2 text-2xl font-black text-red-700 ">{stats.notSubmitted}</p>
 </div>
 )}
 </div>

 {isPaid && (
 <div className="flex gap-1 rounded-xl border border-border bg-[var(--background)] p-1">
 <button onClick={() => setShowNotSubmitted(false)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${!showNotSubmitted ? 'bg-[var(--brand-navy)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
 حضروا ({stats.submitted})
 </button>
 <button onClick={() => setShowNotSubmitted(true)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${showNotSubmitted ? 'bg-[var(--brand-navy)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
 غابوا ({stats.notSubmitted})
 </button>
 </div>
 )}

 <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
 {isPaid ? (
 !showNotSubmitted ? (
 studentsWhoSubmitted.length > 0 ? studentsWhoSubmitted.map((item) => <StudentRow key={item.student._id} student={item.student} submission={item.submission} />) : <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><p className="text-sm font-bold text-[var(--text-muted)]">مفيش طلبة حضروا الامتحان ده</p></div>
 ) : (
 studentsNotSubmitted.length > 0 ? studentsNotSubmitted.map((item) => <StudentRow key={item.student._id} student={item.student} submission={item.submission} />) : <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><p className="text-sm font-bold text-[var(--text-muted)]">كل الطلبة حضروا الامتحان ده</p></div>
 )
 ) : studentsNotSubmitted.length > 0 ? (
 studentsNotSubmitted.map((item) => (
 <div key={item.student._id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] border border-[var(--brand-navy-border)] text-sm font-black">{item.student.firstName?.charAt(0) || "؟"}</span>
 <div><p className="text-sm font-bold text-[var(--text-primary)]">{item.student.firstName} {item.student.lastName}</p><p className="text-xs text-[var(--text-muted)]">{item.student.email}</p></div>
 <span className="ms-auto rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">لسه ممتحنش</span>
 </div>
 ))
 ) : (
 studentsWhoSubmitted.length > 0 ? studentsWhoSubmitted.map((item) => <StudentRow key={item.student._id} student={item.student} submission={item.submission} />) : <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><p className="text-sm font-bold text-[var(--text-muted)]">لسه مفيش طالب امتحن الامتحان ده</p></div>
 )}
 </div>
 </div>
 );
}
