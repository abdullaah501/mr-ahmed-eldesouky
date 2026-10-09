import Image from "next/image";
import User from "../../../../../models/User";
import checkUser from "../../../../../lib/checkUser";
import connectToDatabase from "../../../../../lib/connectToDb";
import UserAnalyticsSection from "@/app/components/analytics/UserAnalyticsSection";
import { withCaller, withTracePhase } from "../../../../../lib/trace/index.js";
import { getImageSrc } from "@/app/components/getImageSrc";
import Link from "next/link";
import Reveal from "@/app/components/ui/Reveal";
import { LuFlaskConical } from "react-icons/lu";
import { FiClipboard, FiBook, FiSettings, FiArrowLeft } from "react-icons/fi";

export const metadata = {
  title: "لوحة الطالب | أ. أحمد الدسوقي",
  description: "تابع مستواك واختباراتك على منصة أ. أحمد الدسوقي للكيمياء.",
  keywords: ["أحمد الدسوقي", "لوحة الطالب", "كيمياء"],
};

const QUICK_NAV = [
  { href: "/userDashboard/exams", label: "اختباراتي", desc: "ابدأ الحل وراجع نتيجتك", icon: FiClipboard },
  { href: "/userDashboard/grades", label: "صفوفي", desc: "محاضراتك وجدولك وحضورك", icon: FiBook },
  { href: "/userDashboard/settings", label: "الإعدادات", desc: "بياناتك وربط ولي الأمر", icon: FiSettings },
];

export default async function Dashboard() {
  return withCaller("user_dashboard_overview_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { user } = await checkUser();
      let userDB = null;
      if (user?.email) {
        await connectToDatabase();
        userDB = await User.findOne(
          { _id: user._id },
          "firstName lastName image role",
        ).lean();
      } else userDB = user;
      if (userDB) userDB = JSON.parse(JSON.stringify(userDB));

      return (
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Editorial welcome band */}
            <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] text-white shadow-sm">
              <div
                className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
                aria-hidden
              />
              <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-[#159A9C]/30 blur-2xl" aria-hidden />
              <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex gap-4">
                  <div className="relative hidden shrink-0 sm:block">
                    <Image
                      src="/logo.png"
                      alt="أ. أحمد الدسوقي — مدرس كيمياء"
                      width={120}
                      height={120}
                      className="h-[104px] w-[104px] rounded-3xl border-2 border-[#FFB81C]/60 bg-white p-2 object-contain"
                    />
                    <span
                      aria-hidden
                      className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-[#FFB81C] text-[#3D2C00]"
                    >
                      <LuFlaskConical size={16} />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#FFB81C]">
                      منصة أ. أحمد الدسوقي — الكيمياء
                    </p>
                    <h1 className="mt-1 text-2xl font-black text-white sm:text-[28px]">
                      أهلاً {userDB?.firstName || "بيك"}
                    </h1>
                    <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/70">
                      الكيمياء مش حفظ معادلات... دي فهم وتفكير. كمّل من مكان
                      ما وقفت — اختبارك الجاي مستنيك.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href="/userDashboard/exams"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFB81C] px-6 py-2.5 text-sm font-black text-[#3D2C00] shadow-sm hover:bg-[#E9A400]"
                      >
                        ابدأ اختبار
                        <FiArrowLeft size={14} className="flip-rtl" />
                      </Link>
                      <span className="inline-flex items-center rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold text-white/75">
                        {userDB?.firstName} {userDB?.lastName} • طالب كيمياء
                      </span>
                    </div>
                  </div>
                </div>
                {user?.image?.cloudId || user?.image?.url ? (
                  <Image
                    src={getImageSrc(user.image)}
                    alt={`${user?.firstName} ${user?.lastName}`}
                    width={64}
                    height={64}
                    className="hidden h-16 w-16 rounded-2xl border border-white/25 object-cover shadow-sm lg:block"
                  />
                ) : null}
              </div>
            </div>
            </Reveal>

            {/* Quick nav rail */}
            <nav aria-label="أقسام اللوحة" className="mt-4 grid gap-3 sm:grid-cols-3">
              {QUICK_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-navy-border)] hover:shadow-md"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] transition-colors group-hover:bg-[#073B40] group-hover:text-[#FFB81C]">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-text-primary">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {item.desc}
                      </span>
                    </span>
                    <FiArrowLeft
                      size={15}
                      className="ms-auto shrink-0 text-text-muted transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--brand-navy)]"
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6">
              <UserAnalyticsSection user={userDB} />
            </div>
          </div>
        </div>
      );
    }),
  );
}
