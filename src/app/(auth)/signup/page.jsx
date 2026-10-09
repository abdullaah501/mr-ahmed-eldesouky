import { Suspense } from "react";
import SignUpForm from "@/app/components/SignUpForm";

export const metadata = {
  title: "إنشاء حساب | أ. أحمد الدسوقي",
  description:
    "انضم لمنصة أ. أحمد الدسوقي دلوقتي واتدرّب على الكيمياء من خلال اختبارات وتدريبات تفاعلية. سجّل مجاناً وابدأ رحلة التعلم.",
  keywords: [
    "إنشاء حساب",
    "تسجيل",
    "أ. أحمد الدسوقي",
    "تعلم الكيمياء",
    "منصة تعليمية",
  ],
  authors: [{ name: "أ. أحمد الدسوقي" }],
  openGraph: {
    title: "إنشاء حساب | أ. أحمد الدسوقي",
    description:
      "سجّل دلوقتي في منصة أ. أحمد الدسوقي وابدأ التدرّب على الكيمياء من خلال اختبارات وتدريبات تفاعلية.",
    url: "https://mr-ahmed-eldesouky.vercel.app/signup",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "https://mr-ahmed-eldesouky.vercel.app/og.jpeg",
        width: 1200,
        height: 896,
        alt: "إنشاء حساب — أ. أحمد الدسوقي",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "إنشاء حساب | أ. أحمد الدسوقي",
    description: "سجّل في منصة أ. أحمد الدسوقي وابدأ رحلة التعلم دلوقتي.",
    images: ["https://mr-ahmed-eldesouky.vercel.app/og.jpeg"],
  },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
