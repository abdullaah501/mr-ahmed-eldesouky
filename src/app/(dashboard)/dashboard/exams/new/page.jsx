import { withCaller, withTracePhase } from "@/../lib/trace/index.js";
import ExamNewClient from "./ExamNewClient";
import checkUser from "@/../lib/checkUser.js";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LuPlus, LuArrowLeft } from "react-icons/lu";

export const metadata = {
  title: "اختبار جديد — أ. أحمد الدسوقي | الكيمياء",
  description: "إنشاء اختبار كيمياء جديد — اختار الصف والعنوان وضيف الأسئلة.",
};

export default async function ExamNewPage() {
  return withCaller("dashboard_exams_new_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || !["admin", "assistant"].includes(user.role))
        redirect("/");

      return (
        <div className="min-h-screen bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy-border)] bg-card shadow-sm">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "linear-gradient(var(--brand-navy) 1px, transparent 1px), linear-gradient(90deg, var(--brand-navy) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[var(--brand-navy-soft)] blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[var(--brand-teal-soft)] blur-2xl"
              />
              <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="flex gap-4">
                  <span className="hidden sm:inline-flex">
                    <Image
                      src="/logo.png"
                      alt="أ. أحمد الدسوقي — مدرس كيمياء"
                      width={48}
                      height={48}
                      className="h-12 w-12 object-contain"
                    />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold tracking-[0.14em] text-[var(--brand-teal)]">
                      اختبار جديد — الكيمياء
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold text-[var(--text-primary)] sm:text-3xl">
                      إنشاء اختبار جديد
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-[var(--brand-navy)]">
                      اختبار كيمياء
                    </p>
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">
                      اختار الصف والعنوان، وضيف أسئلة من البنك أو اعمل أسئلة
                      جديدة، وبعدين احفظ.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Link
                    href="/dashboard/exams"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--brand-navy-soft)] hover:text-[var(--brand-navy)]"
                  >
                    العودة للاختبارات{" "}
                    <LuArrowLeft size={13} />
                  </Link>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-navy)] px-3 py-1.5 text-xs font-black text-white">
                    <LuPlus size={13} /> جديد
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <ExamNewClient role={user.role} />
            </div>
          </div>
        </div>
      );
    }),
  );
}
