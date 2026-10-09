import HeroSection from "../components/HeroSection";
import GradeCard from "../components/GradeCard";
import CTASection from "../components/CTASection";
import WhyChooseMe from "../components/WhyChooseMe";
import Reveal from "../components/ui/Reveal";
import StudentHome from "../components/home/StudentHome";
import MockDashboard from "../components/home/MockDashboard";
import Link from "next/link";
import Hashids from "hashids";
import { LuArrowLeft } from "react-icons/lu";
import connectToDatabase from "../../../lib/connectToDb";
import { getActiveGrades } from "../../../lib/services/grades";
import checkUser from "../../../lib/checkUser";
import { getMyGrades } from "../actions/studentActions";
import { getExams } from "../actions/examActions";
import Submission from "../../../models/Submission";
import Exam from "../../../models/Exam";
import AttendanceRecord from "../../../models/AttendanceRecord";

const STEPS = [
 {
 n: "١",
 title: "اعمل حسابك",
 desc: "سجّل في دقيقة وادخل على المنصة.",
 href: "/signup",
 cta: "إنشاء حساب",
 },
 {
 n: "٢",
 title: "اختار صفك",
 desc: "حدد صفك الدراسي عشان يوصلك المحتوى المناسب.",
 href: "/userDashboard/grades",
 cta: "الصفوف الدراسية",
 },
 {
 n: "٣",
 title: "ابدأ اختبار",
 desc: "حل وراجع نتيجتك وتابع مستواك أول بأول.",
 href: "/userDashboard/exams",
 cta: "الاختبارات",
 },
];

export const metadata = {
 title: "أ. أحمد الدسوقي | مدرس كيمياء",
 description:
 "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات والتدريبات والمراجعات.",
 keywords: [
 "أحمد الدسوقي",
 "أ. أحمد الدسوقي",
 "كيمياء",
 "مدرس كيمياء",
 "اختبارات كيمياء",
 "مراجعات كيمياء",
 "شرح كيمياء",
 ],
openGraph: {
    title: "أ. أحمد الدسوقي | مدرس كيمياء",
    description:
      "اتعلّم الكيمياء بطريقة أبسط وأوضح — شرح ودروس واختبارات وتدريبات ومراجعات.",
    url: "/",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/og.jpeg",
        width: 1200,
        height: 896,
        alt: "أ. أحمد الدسوقي — مدرس كيمياء",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "أ. أحمد الدسوقي | مدرس كيمياء",
    description:
      "اتعلّم الكيمياء بطريقة أبسط وأوضح — شرح ودروس واختبارات وتدريبات ومراجعات.",
    images: ["/og.jpeg"],
  },
};

export default async function Home() {
 await connectToDatabase();
 const { user } = await checkUser();
 const dbGrades = await getActiveGrades();
 const gradeFeatures = [
 "اختبارات تفاعلية",
 "متابعة المستوى",
 "تصحيح فوري",
 ];
 const gradesArr = dbGrades.map((g) => ({
 id: g._id,
 grade: g.name,
 gradeDescription: g.name,
 features: gradeFeatures,
 active: g.active,
 }));

 // Personalized home data — logged-in students only, all read from real
 // platform data (grades, exams, submissions, attendance). Same formulas
 // as /api/student/analytics; no invented numbers.
 let studentHome = null;
 if (user?.role === "student") {
 const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
 const encodeHex = (id) => hashids.encodeHex(String(id));

 const myGradesRes = await getMyGrades();
 const myGrades = myGradesRes?.success ? myGradesRes.data || [] : [];

 let exams = [];
 for (const g of myGrades) {
 const res = await getExams(String(g._id));
 if (res?.success) {
 for (const e of res.data || []) {
 exams.push({ ...e, _gradeName: g.name });
 }
 }
 }

 const unattempted = exams.filter((e) => !e.hasAttempted);
 const first = unattempted[0] || null;
 const qCount = (e) =>
 e?.questionItems?.length ||
 e?.questions?.length ||
 e?._questionCount ||
 0;
 const nextExam = first
 ? {
 title: first.title || "اختبار",
 gradeName: first._gradeName || "",
 questionCount: qCount(first),
 duration: first.durationMinutes || first.duration || null,
 code: encodeHex(first._id),
 }
 : null;

 const showcase = [...unattempted, ...exams.filter((e) => e.hasAttempted)]
 .slice(0, 3)
 .map((e) => JSON.parse(JSON.stringify(e)));

 const submissions = await Submission.find({
 student: user._id,
 isCompleted: true,
 })
 .select("score createdAt exam")
 .sort({ createdAt: -1 })
 .lean();
 let totalCorrect = 0;
 let totalWrong = 0;
 for (const s of submissions) {
 totalCorrect += s.score?.correct || 0;
 totalWrong += s.score?.wrong || 0;
 }
 const totalQuestions = totalCorrect + totalWrong;

 const records = await AttendanceRecord.find({
 "entries.studentId": user._id,
 })
 .sort({ date: -1 })
 .limit(100)
 .select("date entries")
 .lean();
 let attendedCount = 0;
 let attendanceTotal = 0;
 for (const r of records) {
 const mine = (r.entries || []).find(
 (e) => String(e.studentId) === String(user._id),
 );
 if (!mine) continue;
 attendanceTotal += 1;
 if (mine.status === "present" || mine.status === "late")
 attendedCount += 1;
 }

 const recentSubs = submissions.slice(0, 3);
 const recentExamIds = [...new Set(recentSubs.map((s) => String(s.exam)))];
 const recentExams = recentExamIds.length
 ? await Exam.find({ _id: { $in: recentExamIds } })
 .select("_id title")
 .lean()
 : [];
 const titleById = Object.fromEntries(
 recentExams.map((e) => [String(e._id), e.title || "اختبار"]),
 );
 const recent = recentSubs.map((s) => {
 const correct = s.score?.correct || 0;
 const total = correct + (s.score?.wrong || 0);
 return {
 _id: String(s._id),
 code: encodeHex(s.exam),
 title: titleById[String(s.exam)] || "اختبار",
 correct,
 total,
 percent: total > 0 ? Math.round((correct / total) * 100) : 0,
 date: new Date(s.createdAt).toLocaleDateString("ar-EG"),
 };
 });

 studentHome = {
 firstName: user.firstName || "بطل",
 nextExam,
 stats: {
 accuracy:
 totalQuestions > 0
 ? Math.round((totalCorrect / totalQuestions) * 100)
 : 0,
 totalQuestions,
 taken: submissions.length,
 totalAvailable: exams.length,
 attendance:
 attendanceTotal > 0
 ? Math.round((attendedCount / attendanceTotal) * 100)
 : null,
 attendanceTotal,
 },
 showcase,
 recent,
 grades: myGrades.map((g) => ({ id: String(g._id), name: g.name })),
 };
 }

 const isStudent = user?.role === "student" && studentHome;

 return (
 <div className="bg-background">
 <HeroSection />
 <div id="welcome" className="scroll-mt-20">
 {isStudent ? (
 <StudentHome data={studentHome} />
 ) : (
 <>
 <MockDashboard />
 <WhyChooseMe />

 {/* إزاي تبدأ */}
 <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
 <div className="flex flex-wrap items-end justify-between gap-3">
 <div>
 <p className="text-xs font-extrabold text-[var(--brand-teal)]">
 ٣ خطوات بس
 </p>
 <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)] sm:text-3xl">
 إزاي تبدأ؟
 </h2>
 </div>
 </div>
 <Reveal as="ol" scroll className="mt-6 grid gap-4 md:grid-cols-3">
 {STEPS.map((s) => (
 <li
 key={s.n}
 className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
 >
 <span
 aria-hidden
 dir="ltr"
 className="pointer-events-none absolute -top-3 left-3 select-none text-7xl font-black text-[var(--brand-navy-soft)]"
 >
 {s.n}
 </span>
 <div className="relative">
 <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#073B40] text-lg font-black text-[#FFB81C] ">
 {s.n}
 </span>
 <h3 className="mt-4 text-lg font-black text-[var(--text-primary)]">
 {s.title}
 </h3>
 <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
 {s.desc}
 </p>
 <Link
 href={s.href}
 className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[var(--brand-navy)] hover:underline"
 >
 {s.cta}
 <LuArrowLeft size={14} />
 </Link>
 </div>
 </li>
 ))}
 </Reveal>
 </section>

 {/* المواد الدراسية */}
 <section
 id="grades"
 className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
 >
 <Reveal scroll>
 <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
 <div>
 <p className="text-xs font-extrabold text-[var(--brand-teal)]">
 المحتوى التعليمي
 </p>
 <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)] sm:text-3xl">
 المواد الدراسية
 </h2>
 </div>
 <p className="max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)]">
 اختار صفك الدراسي وهتلاقي الشرح والاختبارات والمراجعات المناسبة
 ليك.
 </p>
 </div>
 </Reveal>
 {gradesArr.length === 0 ? (
 <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
 <p className="font-bold text-text-primary">
 لا توجد صفوف متاحة حالياً
 </p>
 <p className="mt-1 text-sm text-text-muted">
 تواصل مع الأستاذ لإضافة صفك الدراسي.
 </p>
 </div>
 ) : (
 <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
 {gradesArr.map((item, i) => (
 <GradeCard key={String(item.id)} item={item} index={i + 1} />
 ))}
 </div>
 )}
 </section>

 <CTASection />
 </>
 )}
 </div>
 </div>
 );
}
