import checkUser from "../../../../../lib/checkUser";
import { redirect } from "next/navigation";
import { withCaller, withTracePhase } from "../../../../../lib/trace/index.js";
import MyExamsSection from "../../../components/userDashboard/MyExamsSection";
import Reveal from "../../../components/ui/Reveal";
import Image from "next/image";
import Link from "next/link";
import { LuArrowLeft, LuClipboardList } from "react-icons/lu";

export const metadata = {
  title: "اختباراتي | أ. أحمد الدسوقي",
  description: "اختبارات الكيمياء الخاصة بصفك — مع تصحيح فوري.",
};

export default async function UserExamsPage() {
  return withCaller("userDashboard_exams_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success, user } = await checkUser();
      if (!success || !user) redirect("/login");

      return (
        <div className="min-h-screen bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] text-white shadow-sm">
              <div
                aria-hidden
                className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-[#159A9C]/30 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[#FFB81C]/15 blur-2xl"
              />
              <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="flex gap-4">
                  <span className="hidden sm:inline-flex">
                    <Image
                      src="/logo.png"
                      alt="أ. أحمد الدسوقي — مدرس كيمياء"
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-2xl bg-white p-1 object-contain"
                    />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-[#FFB81C]">
                      اختباراتي — الكيمياء
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                      اختباراتي
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-white">
                      اختبارات الكيمياء الخاصة بصفك
                    </p>
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/70 sm:text-sm">
                      اختار اختبار، وابدأ الحل، وراجع نتيجتك فوراً.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Link
                    href="/userDashboard/overview"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white hover:text-[#073B40]"
                  >
                    <span aria-hidden>
                      <LuArrowLeft size={13} />
                    </span>{" "}
                    العودة للوحة
                  </Link>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB81C] px-3 py-1.5 text-xs font-black text-[#3D2C00]">
                    <LuClipboardList size={13} /> اختباراتي
                  </span>
                </div>
              </div>
            </div>
            </Reveal>
            <div className="mt-6">
              <MyExamsSection />
            </div>
          </div>
        </div>
      );
    }),
  );
}
