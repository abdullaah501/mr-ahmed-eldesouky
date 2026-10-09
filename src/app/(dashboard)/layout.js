import Head from "next/head";
import Sidenav from "../components/ui/Sidenav";
import ClientWrapper from "../components/dataWrappers/ClientWrapper";
import checkUser from "../../../lib/checkUser";
import { redirect } from "next/navigation";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

export const metadata = {
  title: "لوحة التحكم — أ. أحمد الدسوقي | الكيمياء",
  description:
    "أدر الكورسات التعليمية، وتابع أداء الطلاب، وحلل البيانات من خلال لوحة تحكم أ. أحمد الدسوقي.",
  keywords: [
    "أحمد الدسوقي",
    "لوحة التحكم",
    "الكيمياء",
    "تعليم",
    "تحليل البيانات",
    "الكورسات",
    "إدارة الطلاب",
  ],
  openGraph: {
    title: "لوحة التحكم — أ. أحمد الدسوقي",
    description:
      "أدر الكورسات التعليمية وحلل الأداء بسهولة من خلال لوحة تحكم أ. أحمد الدسوقي.",
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

export default async function DashboardLayout({ children }) {
  return withCaller("dashboard_layout", () =>
    withTracePhase("rsc_render_layout", async () => {
      const { success, user } = await checkUser();
      if (!success || (user?.role !== "admin" && user?.role !== "assistant")) {
        redirect("/");
      }

      const userStr = JSON.stringify(user);

      return (
        <>
          <Head>
            <title>{metadata.title}</title>
            <meta name="description" content={metadata.description} />
            <meta name="keywords" content={metadata.keywords} />
            <meta name="author" content={metadata.author} />
            <meta name="robots" content="index, follow" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <meta property="og:title" content={metadata.title} />
            <meta property="og:description" content={metadata.description} />
            <meta property="og:image" content={metadata.image} />
            <meta property="og:url" content={metadata.siteUrl} />
            <meta property="og:type" content="website" />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={metadata.title} />
            <meta name="twitter:description" content={metadata.description} />
            <meta name="twitter:image" content={metadata.image} />

            <link rel="canonical" href={metadata.siteUrl} />

            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          </Head>

          <main className="flex text-black flex-col mt-12 md:mt-0 md:flex-row max-h-screen">
            <Sidenav initialUser={user} />
            <div className="md:w-4/5 md:max-w-[calc(100vw-256px)] min-h-screen md:mr-auto font-arabic max-h-screen overflow-y-auto">
              <ClientWrapper user={userStr}>{children}</ClientWrapper>
            </div>
          </main>
        </>
      );
    }),
  );
}
