"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { FaArrowLeft, FaBars, FaTimes } from "react-icons/fa";
import {
 FaChartLine,
 FaBook,
 FaPlay,
 FaClipboardCheck,
 FaPenNib,
 FaCog,
 FaUser,
 FaDatabase,
 FaLayerGroup,
 FaCalendarCheck,
 FaCalendarAlt,
 FaBell,
 FaUsers,
 FaClipboardList,
} from "react-icons/fa";
import SideNavLink from "./SideNavLink";
import { useUserStore } from "../../../../stores/user";
import LogoutBtn from "../LogoutBtn";
export default function Sidenav({ initialUser }) {
 const storeUser = useUserStore((s) => s.user);
 const user = storeUser !== undefined ? storeUser : initialUser || null;
 const [isOpen, setIsOpen] = useState(false);

 useEffect(() => {
 const onResize = () => {
 if (window.innerWidth >= 768) setIsOpen(false);
 };
 window.addEventListener("resize", onResize);
 return () => window.removeEventListener("resize", onResize);
 }, []);

 const adminLinks = [
 {
 id: 1,
 title: "نظرة عامة",
 href: "/dashboard/overview",
 icon: FaChartLine,
 },
 { id: 2, title: "الصفوف", href: "/dashboard/grades", icon: FaLayerGroup },
 { id: 3, title: "المحاضرات", href: "/dashboard/lectures", icon: FaPlay },
 {
 id: 4,
 title: "الجدول",
 href: "/dashboard/schedule",
 icon: FaCalendarAlt,
 },
 {
 id: 5,
 title: "الاختبارات",
 href: "/dashboard/exams",
 icon: FaClipboardCheck,
 },
 {
 id: 10,
 title: "النتائج",
 href: "/dashboard/results",
 icon: FaClipboardList,
 },
 {
 id: 6,
 title: "بنك الأسئلة",
 href: "/dashboard/repository",
 icon: FaDatabase,
 },
 { id: 7, title: "المقالي", href: "/dashboard/essays", icon: FaPenNib },
 {
 id: 8,
 title: "الحضور",
 href: "/dashboard/attendance",
 icon: FaCalendarCheck,
 },
 { id: 9, title: "المساعدون", href: "/dashboard/staff", icon: FaUsers },
 {
 id: 11,
 title: "الإشعارات",
 href: "/dashboard/notifications",
 icon: FaBell,
 },
 ];

 const assistantLinks = [
 { id: 1, title: "المحاضرات", href: "/dashboard/lectures", icon: FaPlay },
 {
 id: 2,
 title: "الجدول",
 href: "/dashboard/schedule",
 icon: FaCalendarAlt,
 },
 { id: 3, title: "المقالي", href: "/dashboard/essays", icon: FaPenNib },
 {
 id: 4,
 title: "الاختبارات",
 href: "/dashboard/exams",
 icon: FaClipboardCheck,
 },
 {
 id: 7,
 title: "النتائج",
 href: "/dashboard/results",
 icon: FaClipboardList,
 },
 {
 id: 5,
 title: "بنك الأسئلة",
 href: "/dashboard/repository",
 icon: FaDatabase,
 },
 {
 id: 6,
 title: "الحضور",
 href: "/dashboard/attendance",
 icon: FaCalendarCheck,
 },
 ];

 const userLinks = [
 {
 id: 1,
 title: "نظرة عامة",
 href: "/userDashboard/overview",
 icon: FaUser,
 },
 { id: 2, title: "صفوفي", href: "/userDashboard/grades", icon: FaBook },
 {
 id: 3,
 title: "الاختبارات",
 href: "/userDashboard/exams",
 icon: FaClipboardCheck,
 },
 { id: 4, title: "الإعدادات", href: "/userDashboard/settings", icon: FaCog },
 ];

 const links =
 user?.role === "admin"
 ? adminLinks
 : user?.role === "assistant"
 ? assistantLinks
 : userLinks;

 return (
 <>
 {/* Mobile top bar */}
 <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/15 bg-[#0E666B]/70 px-4 text-white shadow-lg shadow-[#0A4F53]/20 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#0E666B]/60 md:hidden">
 <button
 onClick={() => setIsOpen(true)}
 aria-label="فتح القائمة"
 className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white"
 >
 <FaBars size={18} />
 </button>
 <Link href="/" className="inline-flex items-center">
 <Image
 src="/logo.png"
 alt="أ. أحمد الدسوقي — مدرس كيمياء"
 width={36}
 height={36}
 className="h-[36px] w-[36px] object-contain"
 />
 </Link>
 </div>

 <div
 className={`fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm transition-opacity md:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
 onClick={() => setIsOpen(false)}
 />

 <aside
 className={`fixed inset-y-0 right-0 z-50 flex h-dvh w-[84%] max-w-[320px] flex-col border-l border-white/10 bg-gradient-to-b from-[#073B40] to-[#0B5155] text-white shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:h-screen md:w-64 md:translate-x-0 md:shadow-none ${isOpen ? "translate-x-0" : "translate-x-full"}`}
 >
 {/* Header */}
 <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-white/10 px-5">
 <Link
 href="/"
 className="inline-flex items-center gap-2.5 text-sm font-bold text-white/85 hover:text-white"
 >
 <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-amber)] text-[var(--brand-amber-ink)]">
 <FaArrowLeft size={12} className="flip-rtl" />
 </span>
 <span className="hidden md:inline">العودة للرئيسية</span>
 <span className="md:hidden">الرئيسية</span>
 </Link>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setIsOpen(false)}
 aria-label="إغلاق"
 className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white md:hidden"
 >
 <FaTimes size={16} />
 </button>
 </div>
 </div>

 {/* User */}
 <div className="border-b border-white/10 px-5 py-5">
 <div className="flex items-center gap-3">
 <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-[var(--brand-amber)]">
 {user?.firstName?.charAt(0) || "ك"}
 </span>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-extrabold text-white">
 {user
 ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
 "مستخدم"
 : "أهلاً بيك"}
 </p>
 <p className="text-xs text-white/65">
 منصة الكيمياء — أ. أحمد الدسوقي
 </p>
 </div>
 </div>
 <div className="mt-3 flex items-center gap-2">
 <span className="inline-flex items-center rounded-full bg-[var(--brand-amber)] px-2.5 py-1 text-xs font-bold text-[var(--brand-amber-ink)]">
 {user?.role === "admin"
 ? "مشرف"
 : user?.role === "assistant"
 ? "مساعد"
 : "طالب"}
 </span>
 <span className="text-xs text-white/65">
 {user?.firstName
 ? `${user.firstName} ${user.lastName ?? ""}`
 : ""}
 </span>
 </div>
 </div>

 {/* Nav */}
 <nav aria-label="تنقل اللوحة" className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
 <p className="mb-2 px-2 text-[11px] font-black tracking-wide text-white/45">
 {user?.role === "student" ? "رحلة التعلم" : "إدارة المنصة"}
 </p>
 <div className="space-y-1.5">
 {links.map((link) => (
 <SideNavLink
 key={`${link.href}-${link.id}`}
 link={link}
 tone="teal"
 onClick={() => setIsOpen(false)}
 />
 ))}
 </div>
 </nav>

 {/* Teacher card */}
 <div className="px-3 pb-2">
 <div className="flex items-center gap-2.5 rounded-2xl border border-[#FFB81C]/30 bg-[#FFB81C]/10 p-3">
<Image
  src="/logo.png"
  alt="أ. أحمد الدسوقي"
  width={38}
  height={38}
  className="h-[38px] w-[38px] object-contain"
  />
 <div className="min-w-0">
 <p className="truncate text-xs font-black text-white">
 أ. أحمد الدسوقي
 </p>
 <p dir="ltr" className="text-[11px] font-bold tracking-wide text-[#FFB81C]">
 Bond in Chemistry
 </p>
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="border-t border-white/10 p-3">
 <LogoutBtn fullWidth />
 </div>

 <div className="border-t border-white/10 px-4 py-3 text-center">
 <p className="text-[11px] font-semibold text-white/55">
 الإصدار ٢.٠ — أ. أحمد الدسوقي
 </p>
 <p className="mt-0.5 text-[11px] text-white/55">
 بواسطة{" "}
 <Link href="https://pixelpulse.online/" target="_blank" className="hover:text-white">
 Pixel Pulse
 </Link>
 </p>
 </div>
 </aside>

 <div className="h-16 md:hidden" aria-hidden />
 </>
 );
}
