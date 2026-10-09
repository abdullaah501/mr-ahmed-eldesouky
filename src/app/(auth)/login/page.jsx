import LoginForm from "@/app/components/LoginForm";

export const metadata = {
  title: "تسجيل الدخول | أ. أحمد الدسوقي",
  description:
    "سجّل الدخول لمنصة أ. أحمد الدسوقي بوند الكيمياء — اختبارات وتدريبات ومتابعة للمستوى.",
  openGraph: {
    title: "تسجيل الدخول | أ. أحمد الدسوقي",
    description:
      "سجّل الدخول لمنصة أ. أحمد الدسوقي عشان توصل للاختبارات والتدريبات.",
    url: "https://mr-ahmed-eldesouky.vercel.app/login",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    images: [
      {
        url: "https://mr-ahmed-eldesouky.vercel.app/og.jpeg",
        width: 1200,
        height: 896,
        alt: "تسجيل الدخول — أ. أحمد الدسوقي",
      },
    ],
    locale: "ar_EG",
    type: "website",
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
