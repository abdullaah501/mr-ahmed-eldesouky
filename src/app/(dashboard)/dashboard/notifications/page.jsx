import checkUser from "../../../../../lib/checkUser";
import Image from "next/image";
import { redirect } from "next/navigation";
import { withCaller, withTracePhase } from "../../../../../lib/trace/index.js";
import NotificationsSection from "@/app/components/notifications/NotificationsSection";
import AdminNotificationsTable from "@/app/components/notifications/AdminNotificationsTable";
import Link from "next/link";
import { LuBell, LuArrowLeft } from "react-icons/lu";

export const metadata = {
  title: "الإشعارات — أ. أحمد الدسوقي | الكيمياء",
  description: "ابعت إشعارات لصف كامل أو لطالب معين.",
};

export default async function NotificationsPage() {
  return withCaller("dashboard_notifications_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success, user } = await checkUser();
      if (!success || user?.role !== "admin") redirect("/");

      return (
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
                className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-brand-teal-soft blur-2xl"
              />
              <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="flex gap-4">
                  <span className="hidden sm:inline-flex">
                    <Image
                      src="/logo.png"
                      alt="أ. أحمد الدسوقي — مدرس كيمياء"
                      width={48}
                      height={48}
                      className="h-[48px] w-[48px] object-contain"
                    />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold tracking-[0.14em] text-brand-teal">
                      الإشعارات — الكيمياء
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold text-text-primary sm:text-3xl">
                      الإشعارات
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-brand-navy">
                      ابعت إشعارات لصف كامل أو لطالب معين
                    </p>
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-muted sm:text-sm">
                      ابعت إعلانات أو تغييرات في المواعيد أو تحديثات الحضور —
                      بتوصل للطلاب المستهدفين فوراً.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Link
                    href="/dashboard/overview"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-text-secondary hover:bg-brand-navy-soft hover:text-brand-navy"
                  >
                    العودة للوحة{" "}
                    <LuArrowLeft size={13} />
                  </Link>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1.5 text-xs font-black text-white">
                    <LuBell size={13} /> إشعار
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-8">
              <NotificationsSection />
              <AdminNotificationsTable />
            </div>
          </div>
        </div>
      );
    }),
  );
}
