import Image from "next/image";
import User from "../../../../../models/User";
import checkUser from "../../../../../lib/checkUser";
import AdminAnalyticsSection from "@/app/components/analytics/AdminAnalyticsSection";
import UserAnalyticsSection from "@/app/components/analytics/UserAnalyticsSection";
import connectToDatabase from "../../../../../lib/connectToDb";
import { redirect } from "next/navigation";
import { withCaller, withTracePhase } from "../../../../../lib/trace/index.js";
import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { getImageSrc } from "@/app/components/getImageSrc";

export const metadata = {
  title: "لوحة التحكم — أ. أحمد الدسوقي | الكيمياء",
  description:
    "أدر الصفوف والمحاضرات والاختبارات، وتابع أداء الطلاب من خلال لوحة تحكم أ. أحمد الدسوقي.",
  keywords: ["أحمد الدسوقي", "لوحة التحكم", "الكيمياء", "الثانوية العامة"],
  openGraph: {
    title: "لوحة التحكم — أ. أحمد الدسوقي",
    description: "لوحة إدارة المنصة التعليمية لمادة الكيمياء.",
    url: "https://mr-ahmed-eldesouky.pixelpulse.online/dashboard/overview",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    type: "website",
    images: [
      {
        url: "https://mr-ahmed-eldesouky.pixelpulse.online/og.jpeg",
        width: 1200,
        height: 896,
        alt: "لوحة التحكم — أ. أحمد الدسوقي",
      },
    ],
  },
};

export default async function Dashboard() {
  return withCaller("dashboard_overview_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success, user } = await checkUser();
      if (!success || user?.role !== "admin") redirect("/");
      let userDB = null;
      if (user?.email) {
        await connectToDatabase();
        userDB = await User.findOne(
          { _id: user._id },
          "firstName lastName image role",
        ).lean();
      } else userDB = user;

      const displayName =
        `${userDB?.firstName ?? ""} ${userDB?.lastName ?? ""}`.trim() || "مشرف";

      return (
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Enhanced header */}
            <div className="relative overflow-hidden rounded-3xl border border-(--brand-navy-border) bg-card shadow-sm">
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
                className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-brand-navy-soft blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-brand-teal-soft blur-2xl"
              />
              <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="flex gap-4">
                  <span className="hidden sm:inline-flex">
                    <Image
                      src="/logo.png"
                      alt="أ. أحمد الدسوقي — مدرس كيمياء"
                      width={52}
                      height={52}
                      className="h-[52px] w-[52px] object-contain"
                    />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold tracking-[0.14em] text-brand-teal">
                      أ. أحمد الدسوقي — المشرف
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold text-text-primary sm:text-3xl">
                      أهلاً {displayName}
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-brand-navy">
                      لوحة الكيمياء
                    </p>
                    <p className="mt-1 max-w-lg text-xs leading-relaxed text-text-muted sm:text-sm">
                      تابع طلابك، وأدر صفوفك ومحاضراتك واختباراتك، وراجع النتائج
                      في مكان واحد.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href="/dashboard/exams"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-(--brand-navy-hover)"
                      >
                        إدارة الاختبارات <LuArrowLeft size={13} />
                      </Link>
                      <Link
                        href="/dashboard/grades"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-text-secondary hover:bg-brand-navy-soft hover:text-brand-navy hover:border-(--brand-navy-border)"
                      >
                        الصفوف
                      </Link>
                      <Link
                        href="/dashboard/lectures"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-text-secondary hover:bg-brand-navy-soft hover:text-brand-navy"
                      >
                        المحاضرات
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center">
                  {user?.image?.cloudId || user?.image?.url ? (
                    <Image
                      src={getImageSrc(user.image)}
                      alt={displayName}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-2xl object-cover border border-border shadow-sm"
                    />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-navy text-lg font-black text-white shadow-sm">
                      {user?.firstName?.charAt(0) || "أ"}
                    </span>
                  )}
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-bold text-text-primary">
                      {displayName}
                    </p>
                    <p className="text-xs font-semibold text-brand-navy">
                      مشرف المنصة
                    </p>
                    <p className="text-xs text-text-muted">مدرس كيمياء</p>
                  </div>
                </div>
              </div>
            </div>

            {userDB?.role === "admin" ? (
              <AdminAnalyticsSection />
            ) : (
              <UserAnalyticsSection />
            )}
          </div>
        </div>
      );
    }),
  );
}
