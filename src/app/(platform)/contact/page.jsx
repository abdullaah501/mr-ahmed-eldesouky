import ContactForm from "./../../components/contact/ContactSection";
import Reveal from "./../../components/ui/Reveal";
import Image from "next/image";
import { LuMail } from "react-icons/lu";

export const metadata = {
  title: "تواصل معنا | أ. أحمد الدسوقي",
  description:
    "تواصل مع منصة أ. أحمد الدسوقي مدرس الكيمياء لأي استفسار أو دعم.",
  alternates: {
    canonical: "https://mr-mohamed-talaat.pixelpulse.online/contact",
  },
  openGraph: {
    title: "تواصل معنا | أ. أحمد الدسوقي",
    description: "عندك سؤال؟ تواصل مع منصة أ. أحمد الدسوقي وفريق الدعم.",
    url: "https://mr-mohamed-talaat.pixelpulse.online/contact",
    siteName: "أ. أحمد الدسوقي — الكيمياء",
    images: [
      {
        url: "https://mr-mohamed-talaat.pixelpulse.online/og.jpeg",
        width: 1200,
        height: 896,
        alt: "تواصل معنا — أ. أحمد الدسوقي",
      },
    ],
    locale: "ar_EG",
    type: "website",
  },
};

export default function ContactUsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] text-white shadow-sm">
          <div
            aria-hidden
            className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-[#159A9C]/30 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[#FFB81C]/15 blur-2xl"
          />
          <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex gap-4">
              <span className="hidden sm:inline-flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="أ. أحمد الدسوقي — مدرس كيمياء"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-2xl bg-white p-1 object-contain"
                />
                </span>
              <div>
                <p className="text-xs font-extrabold text-[#FFB81C]">
                  تواصل — الكيمياء
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                  تواصل معنا
                </h1>
                <p className="mt-1 text-sm font-semibold text-white">
                  أ. أحمد الدسوقي — مدرس كيمياء • الإسماعيلية
                </p>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/70 sm:text-sm">
                  عندك سؤال أو استفسار؟ احنا هنا عشان نجاوبك وندعمك في رحلة
                  تعلم الكيمياء.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB81C] px-3 py-1.5 text-xs font-black text-[#3D2C00]">
                <LuMail size={12} /> تواصل
              </span>
            </div>
          </div>
        </div>
        </Reveal>
        <div className="mt-6">
          <ContactForm />
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            inLanguage: "ar",
            mainEntity: {
              "@type": "EducationalOrganization",
              name: "أ. أحمد الدسوقي — مدرس كيمياء",
              url: "https://mr-mohamed-talaat.pixelpulse.online",
              logo: "https://mr-mohamed-talaat.pixelpulse.online/logo.png",
              image: "https://mr-mohamed-talaat.pixelpulse.online/og.jpeg",
            },
          }),
        }}
      />
    </div>
  );
}
