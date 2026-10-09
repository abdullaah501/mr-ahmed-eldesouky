import Head from "next/head";
import { redirect } from "next/navigation";
import Sidenav from "@/app/components/ui/Sidenav";
import ClientWrapper from "@/app/components/dataWrappers/ClientWrapper";
import checkUser from "../../../../lib/checkUser";
import { withCaller, withTracePhase } from "../../../../lib/trace/index.js";

export const metadata = {
  title: "منصة أ. أحمد الدسوقي — لوحة الطالب",
  description:
    "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء بطريقة مبسطة وشاملة لجميع الصفوف.",
  keywords:
    "أحمد الدسوقي, تدريس الكيمياء, دروس الكيمياء, منصة تعليمية, تعلم الكيمياء",
  author: "أ. أحمد الدسوقي",
  siteUrl: "https://mr-ahmed-eldesouky.pixelpulse.online",
  image: "https://mr-ahmed-eldesouky.vercel.app/og.jpeg",
};

export default async function UserDashboardLayout({ children }) {
  return withCaller("user_dashboard_layout", () =>
    withTracePhase("rsc_render_layout", async () => {
      const { success, user } = await checkUser();

      if (!success || user?.role !== "student") {
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
            <meta property="og:locale" content="ar_EG" />
            <meta
              property="og:site_name"
              content="أ. أحمد الدسوقي — الكيمياء"
            />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={metadata.title} />
            <meta name="twitter:description" content={metadata.description} />
            <meta name="twitter:image" content={metadata.image} />

            <link rel="canonical" href={metadata.siteUrl} />

            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          </Head>

          <main className="flex text-foreground flex-col md:flex-row max-h-screen">
            <Sidenav initialUser={user} />
            <div className="md:w-4/5 max-md:pt-16 md:max-w-[calc(100vw-256px)] min-h-screen md:mr-auto font-arabic max-h-screen overflow-y-auto">
              <ClientWrapper user={userStr}>{children}</ClientWrapper>
            </div>
          </main>
        </>
      );
    }),
  );
}
