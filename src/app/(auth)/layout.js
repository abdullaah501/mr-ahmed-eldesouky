import Head from "next/head";
import checkUser from "../../../lib/checkUser";
import { redirect } from "next/navigation";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

export const metadata = {
  title: "أ. أحمد الدسوقي — تسجيل الدخول / إنشاء حساب",
  description:
    "سجّل الدخول لمنصة أ. أحمد الدسوقي مدرس الكيمياء — اختبارات وتدريبات ومراجعات.",
  keywords: ["أحمد الدسوقي", "تسجيل الدخول", "كيمياء", "اختبارات"],
  openGraph: {
    title: "أ. أحمد الدسوقي — تسجيل الدخول",
    description: "سجّل الدخول لمنصتك وابدأ الاختبار.",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    type: "website",
    images: [
      {
        url: "https://mr-ahmed-eldesouky.vercel.app/og.jpeg",
        width: 1200,
        height: 896,
        alt: "أ. أحمد الدسوقي",
      },
    ],
  },
};

export default async function AuthLayout({ children }) {
  return withCaller("auth_layout", () =>
    withTracePhase("rsc_render_layout", async () => {
      const { success, user } = await checkUser();
      if (success || user) redirect("/");
      const userStr = JSON.stringify(user);
      return (
        <>
          <Head>
            <title>{metadata.title}</title>
            <meta name="description" content={metadata.description} />
            <meta name="robots" content="index, follow" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <link
              rel="canonical"
              href="https://mr-ahmed-eldesouky.pixelpulse.online"
            />
            <link rel="icon" href="/favicon.ico" sizes="any" />
          </Head>
          <main className="flex min-h-screen overflow-hidden flex-col bg-background text-foreground">
            <Navbar user={userStr} />
            <div className="flex-1">{children}</div>
            <Footer />
          </main>
        </>
      );
    }),
  );
}
