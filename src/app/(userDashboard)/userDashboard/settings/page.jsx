import UserDataForm from "@/app/components/UserDataForm";
import GuardianLinkCard from "@/app/components/guardian/GuardianLinkCard";
import checkUser from "../../../../../lib/checkUser";
import { withCaller, withTracePhase } from "../../../../../lib/trace/index.js";
import Image from "next/image";
import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";

export default async function SettingsPage() {
  return withCaller("user_dashboard_settings_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success, user } = await checkUser();
      if (!success)
        return (
          <div className="p-6">
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              فشل التحقق من حسابك. حاول مرة أخرى.
            </p>
          </div>
        );

      return (
        <div className="min-h-screen bg-[var(--background)]">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
                className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[var(--brand-navy-soft)] blur-2xl"
              />
              <div className="relative flex items-center gap-4 p-6 sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-navy)] text-white">
                  <Image
                    src="/logo.png"
                    alt="logo"
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain brightness-0 invert"
                  />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-[var(--brand-teal)]">
                    الإعدادات — الكيمياء
                  </p>
                  <h1 className="mt-1 text-xl font-extrabold text-[var(--text-primary)] sm:text-2xl">
                    الإعدادات
                  </h1>
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    إدارة بياناتك وربط ولي الأمر
                  </p>
                </div>
                <Link
                  href="/userDashboard/overview"
                  className="ms-auto hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--brand-navy-soft)] hover:text-[var(--brand-navy)]"
                >
                  <span aria-hidden>
                    <LuArrowLeft size={13} />
                  </span>{" "}
                  العودة للوحة
                </Link>
              </div>
            </div>
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <UserDataForm user={user} />
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <GuardianLinkCard />
              </div>
            </div>
          </div>
        </div>
      );
    }),
  );
}
