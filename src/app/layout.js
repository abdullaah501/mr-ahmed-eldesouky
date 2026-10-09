import { Poppins, Cairo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "../../lib/QueryProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const aminFont = localFont({
  src: [
    {
      path: "../../public/fonts/amin/Amin.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/amin/Amin-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/amin/Amin-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/amin/Amin-Regular.otf",
      weight: "400",
      style: "normal",
    },
  ],
});

export const metadata = {
  metadataBase: new URL("https://mr-mohamed-talaat.pixelpulse.online"),
  manifest: "/manifest.webmanifest",
  title: {
    default: "أ. أحمد الدسوقي | مدرس كيمياء",
    template: "%s | أ. أحمد الدسوقي",
  },
  description:
    "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات والتدريبات والمراجعات.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    title: "أ. أحمد الدسوقي | مدرس كيمياء",
    description:
      "اتعلّم الكيمياء بطريقة أبسط وأوضح — شرح ودروس واختبارات وتدريبات ومراجعات.",
    images: [
      {
        url: "/og.jpeg",
        width: 1200,
        height: 896,
        alt: "أ. أحمد الدسوقي — مدرس كيمياء",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "أ. أحمد الدسوقي | مدرس كيمياء",
    description:
      "اتعلّم الكيمياء بطريقة أبسط وأوضح — شرح ودروس واختبارات وتدريبات ومراجعات.",
    images: ["/og.jpeg"],
  },
};

export const viewport = {
  themeColor: "#073B40",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className="scroll-smooth"
    >
      <body
        className={`${poppins.variable} ${cairo.variable} ${aminFont.className} antialiased bg-background`}
      >
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#073B40",
              color: "#fff",
              boxShadow: "0 8px 24px -4px rgba(7,59,64,0.35)",
              borderRadius: "14px",
              padding: "12px 16px",
              fontSize: "14px",
              fontFamily: "var(--font-cairo), system-ui, sans-serif",
            },
            success: {
              style: {
                background: "#0B5155",
                color: "#fff",
              },
            },
            error: {
              style: {
                background: "#EF4444",
                color: "#fff",
              },
            },
            loading: {
              style: {
                background: "#073B40",
                color: "#fff",
              },
            },
          }}
        />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
