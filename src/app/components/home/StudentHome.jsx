import Link from "next/link";
import {
  LuArrowLeft,
  LuClipboardList,
  LuBookOpen,
  LuFlaskConical,
} from "react-icons/lu";
import AtomOrbit from "../brand/AtomOrbit";
import Reveal from "../ui/Reveal";
import ExamShowcaseCard from "./ExamShowcaseCard";
import MetricRing from "./MetricRing";
import SubjectCard from "./SubjectCard";

/**
 * StudentHome — personalized dashboard homepage for a logged-in student.
 * Every number, exam, grade and result comes from real platform data (props).
 */
export default function StudentHome({ data }) {
  const { firstName, nextExam, stats, showcase, recent, grades = [] } = data;
  const availableCount = showcase.filter((e) => !e.hasAttempted).length;

  return (
    <div className="bg-background">
      {/* stats (right) + welcome & next exam (left) */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* stats */}
          <Reveal className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center justify-between gap-2 text-lg font-black text-text-primary">
              إيه إحصائياتك؟
              <LuClipboardList size={20} className="text-[var(--brand-teal)]" />
            </h2>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <MetricRing
                value={stats.accuracy}
                max={100}
                center={`${stats.accuracy}%`}
                tone="amber"
                label="نسبة النجاح"
                sub={
                  stats.totalQuestions > 0
                    ? `من ${stats.totalQuestions} سؤال`
                    : "لسه ممتحنتش"
                }
              />
              <MetricRing
                value={stats.taken}
                max={Math.max(stats.totalAvailable, 1)}
                center={`${stats.taken}/${stats.totalAvailable}`}
                tone="teal"
                label="الاختبارات المكتملة"
                sub={`من أصل ${stats.totalAvailable}`}
              />
              <MetricRing
                value={stats.attendance ?? 0}
                max={100}
                center={`${stats.attendance ?? 0}%`}
                tone="teal"
                label="نسبة الحضور"
                sub={
                  stats.attendanceTotal > 0
                    ? `من ${stats.attendanceTotal} ${stats.attendanceTotal === 1 ? "حصة" : "حصص"}`
                    : "لا توجد سجلات"
                }
              />
            </div>
            <p className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-teal-soft)] px-4 py-3 text-center text-xs font-black text-[#0B5155]">
              <AtomOrbit size={26} variant="light" animated={false} />
              كل خطوة بتقربك من هدفك.. استمر!
            </p>
          </Reveal>

          {/* welcome + next exam */}
          <Reveal
            delay={0.1}
            className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <h2 className="text-lg font-black text-text-primary">
              مرحباً يا {firstName}! 👋
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {availableCount > 0
                ? `استمر في رحلتك نحو التفوق في الكيمياء — عندك ${availableCount} ${availableCount === 1 ? "اختبار" : "اختبارات"} جديد`
                : "استمر في رحلتك نحو التفوق في الكيمياء — راجع نتائجك الحالية"}
            </p>

            {nextExam ? (
              <div className="relative mt-4 flex-1 overflow-hidden rounded-2xl bg-gradient-to-bl from-[#073B40] to-[#0B5155] p-5 text-white">
                <div
                  aria-hidden
                  className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
                />
                <AtomOrbit
                  size={130}
                  variant="dark"
                  animated={false}
                  className="absolute -bottom-6 -left-4 opacity-70"
                />
                <div className="relative">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB81C] px-3 py-1 text-[11px] font-black text-[#3D2C00]">
                    <LuClipboardList size={12} /> الامتحان القادم
                  </p>
                  <h3 className="mt-3 line-clamp-2 text-lg font-black leading-snug">
                    {nextExam.title}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-white/60">
                    {nextExam.gradeName}
                    {nextExam.questionCount > 0
                      ? ` • ${nextExam.questionCount} ${nextExam.questionCount === 1 ? "سؤال" : "أسئلة"}`
                      : ""}
                    {nextExam.duration ? ` • ${nextExam.duration} دقيقة` : ""}
                  </p>
                  <Link
                    href={`/exam/${nextExam.code}`}
                    className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FFB81C] px-6 py-2.5 text-sm font-black text-[#3D2C00] transition-colors hover:bg-[#E9A400]"
                  >
                    ابدأ الامتحان
                    <LuArrowLeft size={15} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex-1 rounded-2xl border border-dashed border-border bg-background p-5 text-center text-sm font-bold text-text-muted">
                لا توجد اختبارات جديدة حالياً — تابع صفك لأي جديد
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* available exams */}
      {showcase.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-2 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black text-text-primary sm:text-2xl">
              <LuClipboardList size={22} className="text-[var(--brand-teal)]" />
              الامتحانات المتاحة
            </h2>
            <Link
              href="/userDashboard/exams"
              className="inline-flex items-center gap-1 text-sm font-black text-[var(--brand-navy)] hover:underline"
            >
              عرض الكل
              <LuArrowLeft size={15} />
            </Link>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((exam, i) => (
              <ExamShowcaseCard
                key={exam._id}
                exam={exam}
                featured={showcase.length === 3 && i === 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* subjects */}
      {grades.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black text-text-primary sm:text-2xl">
              <LuBookOpen size={22} className="text-[var(--brand-teal)]" />
              المواد الدراسية
            </h2>
            <Link
              href="/userDashboard/grades"
              className="inline-flex items-center gap-1 text-sm font-black text-[var(--brand-navy)] hover:underline"
            >
              عرض الكل
              <LuArrowLeft size={15} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {grades.slice(0, 4).map((g) => (
              <SubjectCard key={g.id} grade={g} />
            ))}
          </div>
        </section>
      )}

      {/* results (right) + quote (left) */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {recent.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-text-primary">
                  آخر نتائجك
                  <LuClipboardList size={19} className="text-[var(--brand-teal)]" />
                </h2>
              </div>
              <div className="overflow-x-auto p-3 sm:p-4">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-right text-[11px] font-black text-text-muted">
                      <th className="px-3 py-2.5 font-black">الامتحان</th>
                      <th className="px-3 py-2.5 font-black">التاريخ</th>
                      <th className="px-3 py-2.5 font-black">الدرجة</th>
                      <th className="px-3 py-2.5 font-black">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {recent.map((r) => (
                      <tr key={r._id} className="text-right">
                        <td className="max-w-[220px] truncate px-3 py-3 font-bold text-text-primary">
                          <Link
                            href={`/exam/${r.code}`}
                            className="hover:text-[var(--brand-navy)] hover:underline"
                          >
                            {r.title}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-text-muted">
                          {r.date}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            dir="ltr"
                            className="font-black tabular-nums text-[#7A5200]"
                          >
                            {r.percent}%
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                              r.percent >= 50
                                ? "bg-[var(--brand-teal-soft)] text-[#0E7C7E]"
                                : "bg-[var(--brand-amber-soft)] text-[#8A5A00]"
                            }`}
                          >
                            {r.percent >= 50 ? "ناجح" : "محتاج مراجعة"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-start px-5 pb-5 sm:px-6">
                <Link
                  href="/userDashboard/overview"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#073B40] px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-[#0B5155]"
                >
                  عرض جميع النتائج
                  <LuArrowLeft size={13} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-bold text-text-muted">
              لا توجد نتائج بعد — ابدأ أول اختبار ليك وظهر مستواك هنا
            </div>
          )}

          {/* quote */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-bl from-[#073B40] to-[#0B5155] p-6 text-white sm:p-7">
            <div
              aria-hidden
              className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
            />
            <div className="relative flex justify-center">
              <AtomOrbit size={130} variant="dark" animated />
            </div>
            <div className="relative mt-6">
              <p className="text-xl font-black leading-relaxed">
                النجاح مش صدفة..
                <br />
                ده نتيجة مجهود مستمر.
              </p>
              <p className="mt-3 text-sm font-bold text-[#FFB81C]">
                أ. أحمد الدسوقي
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <Reveal scroll>
          <div className="relative overflow-hidden rounded-2xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] px-6 py-10 text-white sm:px-10">
            <div
              className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
              aria-hidden
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -left-8 hidden opacity-70 sm:block"
            >
              <AtomOrbit size={140} variant="dark" animated />
            </div>
            <div className="relative flex flex-col items-center gap-5 text-center lg:flex-row lg:justify-between lg:text-right">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-black leading-snug text-[#FFB81C] sm:text-3xl">
                  جاهز تبدأ رحلتك للتفوق في الكيمياء؟
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/80 sm:text-base">
                  اختبر مستواك في دقايق واعرف بالظبط محتاج تحسّن إيه — كل ما
                  تدقّق، درجتك أعلى.
                </p>
              </div>
              <Link
                href={
                  nextExam ? `/exam/${nextExam.code}` : "/userDashboard/exams"
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFB81C] px-8 py-3.5 text-sm font-black text-[#3D2C00] shadow-md transition-all hover:bg-[#E9A400] active:scale-[0.98]"
              >
                {nextExam ? "ابدأ الامتحان" : "تصفح الاختبارات"}
                <LuFlaskConical size={16} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}