"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
 cairoWeekday,
 cairoTimeKey,
 formatCairo,
} from "../../../../lib/schedule/time";

const DAYS_AR = [
 "الأحد",
 "الاثنين",
 "الثلاثاء",
 "الأربعاء",
 "الخميس",
 "الجمعة",
 "السبت",
];
import {
 FiPlay,
 FiCalendar,
 FiClipboard,
 FiUserCheck,
 FiChevronDown,
 FiArrowLeft,
} from "react-icons/fi";
import Link from "next/link";
import LecturePlayer from "../LecturePlayer";
import ExamCard from "../Exams/ExamCard";
import Spinner from "../ui/Spinner";

const TABS = [
 { id: "lectures", label: "المحاضرات", icon: FiPlay },
 { id: "schedule", label: "الجدول", icon: FiCalendar },
 { id: "exams", label: "الاختبارات", icon: FiClipboard },
 { id: "attendance", label: "الحضور", icon: FiUserCheck },
];

function LectureRow({ lecture }) {
 const [open, setOpen] = useState(false);
 return (
 <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
 className="w-full text-right p-4 flex items-center justify-between gap-3 hover:bg-foreground/[0.02] transition-colors"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-semibold text-sm">{lecture.title}</span>
 {lecture.recording?.provider && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 font-medium">
 {lecture.recording.provider === "youtube" ? "YouTube" : "Zoom"}
 </span>
 )}
 </div>
 {lecture.scheduledFor && (
 <p className="text-xs text-foreground/60 mt-1 flex items-center gap-1">
 <FiCalendar size={11} />
 {format(new Date(lecture.scheduledFor), "yyyy-MM-dd HH:mm")}
 </p>
 )}
 {lecture.description && !open && (
 <p className="text-xs text-foreground/50 mt-1 line-clamp-1">
 {lecture.description}
 </p>
 )}
 </div>
 <FiChevronDown
 size={16}
 className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
 />
 </button>
 {open && (
 <div className="px-4 pb-4 border-t border-foreground/5 pt-4">
 {lecture.description && (
 <p className="text-sm text-foreground/70 mb-3">
 {lecture.description}
 </p>
 )}
 <LecturePlayer recording={lecture.recording} title={lecture.title} />
 {lecture.files?.length > 0 && (
 <div className="mt-3 space-y-1.5">
 <p className="text-xs font-semibold text-foreground/60">
 المرفقات
 </p>
 {lecture.files.map((f, i) => (
 <Link
 key={i}
 href={f.url}
 target="_blank"
 rel="noreferrer"
 className="block text-xs text-primary hover:underline truncate"
 >
 {f.name || f.url}
 </Link>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 );
}

export default function GradeDetail({ gradeId }) {
 const [tab, setTab] = useState("lectures");

 const lecturesQuery = useQuery({
 queryKey: ["studentLectures", gradeId],
 queryFn: async () => {
 const { getLecturesForStudent } =
 await import("@/app/actions/lectureActions");
 const res = await getLecturesForStudent(gradeId);
 if (!res?.success) throw new Error(res?.message || "Unauthorized");
 return res.data;
 },
 refetchOnWindowFocus: false,
 });

 const examsQuery = useQuery({
 queryKey: ["studentGradeExams", gradeId],
 queryFn: async () => {
 const { getExams } = await import("@/app/actions/examActions");
 const res = await getExams(gradeId);
 if (!res?.success) throw new Error(res?.message || "Unauthorized");
 return res.data || [];
 },
 enabled: tab === "exams",
 refetchOnWindowFocus: false,
 });

 const attendanceQuery = useQuery({
 queryKey: ["myAttendance"],
 queryFn: async () => {
 const { getMyAttendance } =
 await import("@/app/actions/attendanceActions");
 const res = await getMyAttendance();
 if (!res?.success) throw new Error(res?.message || "Unauthorized");
 return res.data;
 },
 enabled: tab === "attendance",
 refetchOnWindowFocus: false,
 });

 // Schedule = standalone timetable (ScheduleEvent), server-side: authorized
 // grade only, Cairo timezone, current-in-progress + upcoming, nearest first.
 const scheduleQuery = useQuery({
 queryKey: ["studentSchedule", gradeId],
 queryFn: async () => {
 const { getScheduleForStudent } =
 await import("@/app/actions/scheduleActions");
 const res = await getScheduleForStudent(gradeId);
 if (!res?.success) throw new Error(res?.message || "Unauthorized");
 return res.data || [];
 },
 enabled: tab === "schedule",
 refetchOnWindowFocus: false,
 });

 const gradeName =
 (lecturesQuery.data || [])[0]?.gradeId?.name ||
 examsQuery.data?.[0]?.gradeId?.name ||
 "";

 const STATUS_LABELS = {
 present: "حاضر",
 late: "متأخر",
 absent: "غائب",
 };
 const STATUS_STYLES = {
 present: "text-emerald-600 bg-emerald-500/10",
 late: "text-amber-600 bg-amber-500/10",
 absent: "text-red-600 bg-red-500/10",
 };

 return (
 <div className="max-w-5xl mx-auto space-y-6">
 <Link
 href="/userDashboard/grades"
 className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors"
 >
 <FiArrowLeft size={14} className="flip-rtl" /> صفوفي
 </Link>

 <div
 role="tablist"
 aria-label="أقسام الصف"
 className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-background p-1.5"
 >
 {TABS.map((t) => {
 const Icon = t.icon;
 const selected = tab === t.id;
 return (
 <button
 key={t.id}
 type="button"
 role="tab"
 aria-selected={selected}
 onClick={() => setTab(t.id)}
 className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-black transition-all sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${
 selected
 ? "bg-[#073B40] text-white shadow-sm "
 : "text-text-muted hover:bg-card hover:text-text-primary"
 }`}
 >
 <Icon size={15} />
 {t.label}
 </button>
 );
 })}
 </div>

 {lecturesQuery.isError ? (
 <p className="text-center py-12 text-red-500 text-sm">
 {lecturesQuery.error?.message ||
 "ليس لديك صلاحية لهذا الصف"}
 </p>
 ) : tab === "lectures" ? (
 lecturesQuery.isLoading ? (
 <Spinner text="جاري التحميل..." />
 ) : (lecturesQuery.data || []).length === 0 ? (
 <p className="text-center py-12 text-foreground/50 text-sm border border-dashed border-foreground/10 rounded-2xl">
 لا توجد محاضرات منشورة بعد
 </p>
 ) : (
 <div className="space-y-3">
 {lecturesQuery.data.map((lec) => (
 <LectureRow key={lec._id} lecture={lec} />
 ))}
 </div>
 )
 ) : tab === "schedule" ? (
 scheduleQuery.isLoading ? (
 <Spinner text="جاري التحميل..." />
 ) : scheduleQuery.isError ? (
 <p className="text-center py-12 text-red-500 text-sm">
 {scheduleQuery.error?.message || "فشل تحميل الجدول"}
 </p>
 ) : (scheduleQuery.data || []).length === 0 ? (
 <p className="text-center py-12 text-foreground/50 text-sm border border-dashed border-foreground/10 rounded-2xl">
 لا توجد حصص قادمة
 </p>
 ) : (
 <div className="space-y-2 max-w-xl">
 {scheduleQuery.data.map((occ) => {
 const start = new Date(occ.startAt);
 const end = occ.endAt ? new Date(occ.endAt) : null;
 return (
 <div
 key={`${occ.eventId}-${occ.startAt}`}
 className="flex items-center justify-between gap-3 bg-background border border-foreground/10 rounded-xl p-3.5"
 >
 <div className="min-w-0">
 <p className="font-medium text-sm">{occ.title}</p>
 <p className="text-xs text-foreground/50 flex items-center gap-2 mt-0.5">
 <span className="flex items-center gap-1">
 <FiCalendar size={11} />
 {DAYS_AR[cairoWeekday(start)]}
 </span>
 <span dir="ltr">
 {end
 ? `${cairoTimeKey(start)} → ${cairoTimeKey(end)}`
 : cairoTimeKey(start)}
 </span>
 <span className="text-foreground/40">
 {formatCairo(start).slice(0, 10)}
 </span>
 <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
 {occ.mode === "offline" ? "أوفلاين" : "أونلاين"}
 </span>
 </p>
 {occ.mode === "offline" && occ.location?.name && (
 <p className="text-xs text-foreground/50 mt-0.5">
 المكان: {occ.location.name}
 </p>
 )}
 {occ.mode === "online" && occ.onlineUrl && (
 <Link
 href={occ.onlineUrl}
 target="_blank"
 rel="noreferrer"
 className="text-xs text-primary hover:underline mt-0.5 inline-block max-w-full truncate"
 dir="ltr"
 >
 {occ.onlineUrl}
 </Link>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )
 ) : tab === "exams" ? (
 examsQuery.isLoading ? (
 <Spinner text="جاري التحميل..." />
 ) : (examsQuery.data || []).length === 0 ? (
 <p className="text-center py-12 text-foreground/50 text-sm border border-dashed border-foreground/10 rounded-2xl">
 لا توجد اختبارات في هذا الصف بعد
 </p>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {examsQuery.data.map((exam) => (
 <ExamCard key={exam._id} exam={exam} />
 ))}
 </div>
 )
 ) : attendanceQuery.isLoading ? (
 <Spinner text="جاري التحميل..." />
 ) : attendanceQuery.isError ? (
 <p className="text-center py-8 text-red-500 text-sm">
 فشل تحميل الحضور
 </p>
 ) : (
 <div className="space-y-4 max-w-xl">
 {(() => {
 const data = attendanceQuery.data;
 const allSessions = (data.sessions || []).filter(
 (s) => String(s.gradeId) === String(gradeId),
 );
 const pct = data.percentage;
 return (
 <>
 <div className="bg-background border border-foreground/10 rounded-2xl p-5 flex items-center justify-between">
 <span className="text-sm font-semibold">نسبة الحضور</span>
 <span
 className={`text-2xl font-bold ${
 pct == null
 ? "text-foreground/40"
 : pct >= 75
 ? "text-emerald-500"
 : pct >= 50
 ? "text-amber-500"
 : "text-red-500"
 }`}
 >
 {pct == null ? "—" : `${pct}%`}
 </span>
 </div>
 {allSessions.length === 0 ? (
 <p className="text-center py-8 text-foreground/50 text-sm border border-dashed border-foreground/10 rounded-2xl">
 لا توجد سجلات حضور بعد
 </p>
 ) : (
 <div className="space-y-2">
 {allSessions.map((s) => (
 <div
 key={s.id}
 className="flex items-center justify-between bg-background border border-foreground/10 rounded-xl p-3"
 >
 <span className="text-xs text-foreground/60">
 {s.gradeName} —{" "}
 {format(new Date(s.date), "yyyy-MM-dd")}
 </span>
 <span
 className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status]}`}
 >
 {STATUS_LABELS[s.status]}
 </span>
 </div>
 ))}
 </div>
 )}
 </>
 );
 })()}
 </div>
 )}
 </div>
 );
}
