import Link from "next/link";
import Image from "next/image";
import { FaTiktok, FaYoutube, FaArrowRight } from "react-icons/fa6";
import { FiFacebook, FiInstagram, FiArrowLeft } from "react-icons/fi";
import { TEACHER_SOCIALS, FOOTER_LINKS } from "./brand/teacherBrand";

export default function Footer() {
 return (
 <footer className="mt-16 border-t border-white/15 bg-gradient-to-b from-[#0E666B]/75 to-[#0A4F53]/85 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl backdrop-saturate-150 ">
 {/* subtle chemistry dot pattern */}
 <div
 className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
 aria-hidden
 />
 <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 <div className="grid grid-cols-1 gap-10 py-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
 {/* Brand */}
 <div className="space-y-4 lg:col-span-1">
<div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="أ. أحمد الدسوقي — مدرس كيمياء"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
              />
              <div>
                <p className="text-lg font-black leading-tight text-white">
 أ. أحمد الدسوقي
 </p>
 <p className="text-xs font-bold text-[#FFB81C]">
 مدرس كيمياء • الإسماعيلية
 </p>
 </div>
 </div>
<p
  dir="ltr"
  className="border-s-2 border-[#FFB81C] ps-3 text-base font-black tracking-wide text-[#FFB81C]"
  >
  Bond in Chemistry
  </p>
<p className="max-w-sm text-[13px] leading-relaxed text-white/70">
  منصة تعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات
  والتدريبات والمراجعات.
 </p>
 <div className="flex flex-wrap gap-2 text-xs font-semibold">
 <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">
 شرح الدروس
 </span>
 <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">
 الاختبارات
 </span>
 <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">
 المراجعات
 </span>
 <span className="rounded-full bg-[#FFB81C] px-3 py-1 text-[#3D2C00]">
 الكيمياء
 </span>
 </div>
 </div>

 {/* Quick links */}
 <nav aria-label="روابط سريعة" className="space-y-4">
 <h4 className="text-sm font-extrabold tracking-wide text-white">
 روابط سريعة
 </h4>
 <ul className="space-y-2.5 text-sm text-white/80">
 {FOOTER_LINKS.map((link) => (
 <li key={link.href + link.label}>
 <Link
 href={link.href}
 className="inline-flex items-center gap-1.5 hover:text-white hover:translate-x-[2px] transition-all"
 >
 <FaArrowRight size={10} className="opacity-60" />
 {link.label}
 </Link>
 </li>
 ))}
 <li>
 <Link
 href="/userDashboard/overview"
 className="inline-flex items-center gap-1.5 hover:text-white hover:translate-x-[2px] transition-all"
 >
 <FaArrowRight size={10} className="opacity-60" />
 لوحة الطالب
 </Link>
 </li>
 </ul>
 </nav>

 {/* For students */}
 <nav aria-label="للطالب" className="space-y-4">
 <h4 className="text-sm font-extrabold tracking-wide text-white">
 للطالب
 </h4>
 <ul className="space-y-2.5 text-sm text-white/80">
 <li>
 <Link
 href="/userDashboard/exams"
 className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
 >
 <FiArrowLeft size={12} className="opacity-60 flip-rtl" />
 الاختبارات
 </Link>
 </li>
 <li>
 <Link
 href="/userDashboard/grades"
 className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
 >
 <FiArrowLeft size={12} className="opacity-60 flip-rtl" />
 صفوفـي الدراسية
 </Link>
 </li>
 <li>
 <Link
 href="/contact"
 className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
 >
 <FiArrowLeft size={12} className="opacity-60 flip-rtl" />
 تواصل معنا
 </Link>
 </li>
 </ul>
 </nav>

 {/* Social */}
 <div className="space-y-4">
 <h4 className="text-sm font-extrabold tracking-wide text-white">
 تابعنا
 </h4>
 <p className="text-sm text-white/80">
 تابع شرح ومراجعات الكيمياء على منصات الأستاذ.
 </p>
 <div className="flex gap-2 pt-1">
 {[
 {
 href: TEACHER_SOCIALS.facebook,
 label: "فيسبوك",
 icon: FiFacebook,
 },
 {
 href: TEACHER_SOCIALS.instagram,
 label: "انستجرام",
 icon: FiInstagram,
 },
 {
 href: TEACHER_SOCIALS.tiktok,
 label: "تيك توك",
 icon: FaTiktok,
 },
 {
 href: TEACHER_SOCIALS.youtube,
 label: "يوتيوب",
 icon: FaYoutube,
 },
 ].map(({ href, label, icon: Icon }) => (
 <Link
 key={label}
 href={href}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={label}
 className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-[#FFB81C] hover:text-[#3D2C00] hover:border-[#FFB81C] transition-colors"
 >
 <Icon size={16} />
 </Link>
 ))}
 </div>
 </div>
 </div>

 <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-white/60 sm:flex-row">
 <p>© {new Date().getFullYear()} أ. أحمد الدسوقي. جميع الحقوق محفوظة.</p>
 <p className="flex items-center gap-1.5">
 صُنعت لطلاب الكيمياء <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#FFB81C]" /> مع{" "}
 <Link
 href="https://pixelpulse.online"
 target="_blank"
 className="hover:underline"
 >
 Pixel Pulse
 </Link>
 </p>
 </div>
 </div>
 </footer>
 );
}
