import checkUser from "../../../../../../lib/checkUser";
import { redirect } from "next/navigation";
import {
  withCaller,
  withTracePhase,
} from "../../../../../../lib/trace/index.js";
import GradeDetail from "@/app/components/userDashboard/GradeDetail";
import Image from "next/image";
import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";

export const metadata = {
  title: "صفي الدراسي | أ. أحمد الدسوقي",
  description: "تفاصيل صف الكيمياء — المحاضرات والاختبارات والنتائج.",
};

export default async function GradeDetailPage({ params }) {
  const { gradeId } = await params;
  return withCaller("user_grade_detail_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success, user } = await checkUser();
      if (!success || !user) redirect("/login");

      return (
        <div className="min-h-screen bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-6 flex items-center gap-3">
              <Link
                href="/userDashboard/grades"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--brand-navy-soft)] hover:text-[var(--brand-navy)]"
              >
                <span aria-hidden>
                  <LuArrowLeft size={13} />
                </span>{" "}
                صفوفي
              </Link>
              <span className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                <Image
                  src="/logo.png"
                  alt="أ. أحمد الدسوقي — مدرس كيمياء"
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />{" "}
                تفاصيل الصف
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <GradeDetail gradeId={String(gradeId)} />
            </div>
          </div>
        </div>
      );
    }),
  );
}
