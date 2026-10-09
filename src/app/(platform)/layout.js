import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import checkUser from "../../../lib/checkUser";
import ClientWrapper from "../components/dataWrappers/ClientWrapper";
import ChatBot from "../components/chat/ChatBot";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";
import { TEACHER_SOCIALS } from "../components/brand/teacherBrand";
import { redirect } from "next/navigation";

const schemaData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://mr-ahmed-eldesouky.pixelpulse.online/#website",
    name: "أ. أحمد الدسوقي — منصة الكيمياء",
    alternateName: "منصة أحمد الدسوقي للكيمياء",
    url: "https://mr-ahmed-eldesouky.pixelpulse.online",
    description:
      "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات والتدريبات والمراجعات.",
    inLanguage: "ar",
    publisher: {
      "@type": "Organization",
      "@id": "https://mr-ahmed-eldesouky.pixelpulse.online/#organization",
      name: "أ. أحمد الدسوقي",
      url: "https://mr-ahmed-eldesouky.pixelpulse.online",
      logo: {
        "@type": "ImageObject",
        url: "https://mr-ahmed-eldesouky.pixelpulse.online/og.jpeg",
        width: 400,
        height: 400,
      },
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://mr-ahmed-eldesouky.pixelpulse.online/#organization",
    name: "أ. أحمد الدسوقي",
    alternateName: ["منصة أحمد الدسوقي", "أحمد الدسوقي كيمياء"],
    url: "https://mr-ahmed-eldesouky.pixelpulse.online",
    logo: {
      "@type": "ImageObject",
      url: "https://mr-ahmed-eldesouky.pixelpulse.online/og.jpeg",
      width: 400,
      height: 400,
    },
    description:
      "منصة تعليمية للكيمياء مع أ. أحمد الدسوقي — شرح ودروس واختبارات وتدريبات ومراجعات.",
    founder: {
      "@type": "Person",
      name: "أحمد الدسوقي",
      jobTitle: "مدرس كيمياء",
    },
    sameAs: [
      TEACHER_SOCIALS.facebook,
      TEACHER_SOCIALS.instagram,
      TEACHER_SOCIALS.tiktok,
      TEACHER_SOCIALS.youtube,
    ],
  },
];

export const metadata = {
  title: "أ. أحمد الدسوقي | مدرس كيمياء",
  description:
    "اتعلّم الكيمياء بطريقة أبسط وأوضح مع أ. أحمد الدسوقي — شرح ودروس واختبارات وتدريبات ومراجعات.",
  keywords: [
    "أحمد الدسوقي",
    "أ. أحمد الدسوقي",
    "كيمياء",
    "مدرس كيمياء",
    "اختبارات كيمياء",
    "شرح كيمياء",
  ],
  authors: [{ name: "أ. أحمد الدسوقي" }],
  creator: "أ. أحمد الدسوقي",
  publisher: "أ. أحمد الدسوقي",
  openGraph: {
    title: "أ. أحمد الدسوقي | مدرس كيمياء",
    description:
      "اتعلّم الكيمياء بطريقة أبسط وأوضح — شرح ودروس واختبارات ومراجعات.",
    url: "https://mr-ahmed-eldesouky.pixelpulse.online",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "https://mr-ahmed-eldesouky.pixelpulse.online/og.jpeg",
        width: 1200,
        height: 896,
        alt: "أ. أحمد الدسوقي — مدرس كيمياء",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "أ. أحمد الدسوقي | مدرس كيمياء",
    description: "اتعلّم الكيمياء بطريقة أبسط وأوضح.",
    images: ["https://mr-ahmed-eldesouky.pixelpulse.online/og.jpeg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default async function PlatformLayout({ children }) {
  return withCaller("platform_layout", () =>
    withTracePhase("rsc_render_layout", async () => {
      const { user } = await checkUser();
      const userStr = JSON.stringify(user) || null;
      if (user?.role === "admin") redirect("/dashboard/overview");
      else if (user?.role === "assistant") redirect("/dashboard/lectures");

      return (
        <div className="overflow-x-clip">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
          />
          <meta property="og:site_name" content="أ. أحمد الدسوقي — الكيمياء" />
          <meta name="application-name" content="أ. أحمد الدسوقي — الكيمياء" />
          <link
            rel="canonical"
            href="https://mr-ahmed-eldesouky.pixelpulse.online"
          />
          <ClientWrapper user={userStr}>
            <Navbar initUser={userStr} />
            <div className="font-amin text-text-primary">{children}</div>
            <ChatBot />
            <Footer />
          </ClientWrapper>
        </div>
      );
    }),
  );
}
