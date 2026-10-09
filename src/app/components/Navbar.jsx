"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useCallback, useId } from "react";
import { usePathname } from "next/navigation";
import { LiaSignInAltSolid } from "react-icons/lia";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import LogoutBtn from "./LogoutBtn";
import { useUserStore } from "../../../stores/user";
import ScrollProgressBar from "./ScrollProgressBar";
import { NAV_LINKS } from "./brand/teacherBrand";

export default function Navbar({ initUser }) {
 const storeUser = useUserStore((s) => s.user);
 const pathname = usePathname();
 const parsedInitUser = useMemo(() => {
 if (!initUser) return null;
 try {
 return JSON.parse(initUser);
 } catch {
 return null;
 }
 }, [initUser]);
 const user = storeUser !== undefined ? storeUser : parsedInitUser;
 const [isOpen, setIsOpen] = useState(false);
 const panelId = useId();
 const toggleMobileMenu = useCallback(() => setIsOpen((p) => !p), []);
 const closeMenu = useCallback(() => setIsOpen(false), []);
 const isActive = (href) =>
 href === "/" ? pathname === "/" : pathname?.startsWith(href);

 return (
 <div className="sticky top-0 z-40 w-full border-b border-white/15 bg-[#0E666B]/70 text-white shadow-lg shadow-[#0A4F53]/20 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#0E666B]/60 ">
 <ScrollProgressBar />
 <nav
 aria-label="التنقل الرئيسي"
 className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8"
 >
{/* Brand — logo only (the artwork already spells out the name) */}
  <Link
  href="/"
  onClick={closeMenu}
  className="flex shrink-0 items-center"
  aria-label="أ. أحمد الدسوقي — الرئيسية"
  >
  <Image
  src="/logo.png"
  alt="أ. أحمد الدسوقي"
  width={44}
  height={44}
  priority
  className="h-11 w-11 object-contain"
  />
  </Link>

 {/* Desktop links — amber underline active state */}
 <div className="hidden items-center gap-1 lg:flex ms-4">
 {NAV_LINKS.map((link) => {
 const active = isActive(link.href);
 return (
 <Link
 key={link.href + link.label}
 href={link.href}
 aria-current={active ? "page" : undefined}
 className={`relative rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
 active
 ? "text-white"
 : "text-white/65 hover:text-white hover:bg-white/10"
 }`}
 >
 {link.label}
 <span
 aria-hidden
 className={`absolute inset-x-3 -bottom-[13px] h-[3px] rounded-full bg-[#FFB81C] transition-all ${
 active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
 }`}
 />
 </Link>
 );
 })}
 </div>

 {/* Desktop actions */}
 <div className="hidden items-center gap-3 md:flex ms-auto">
 {user ? (
 <>
 <Link
 title={
 user?.role === "admin" || user?.role === "assistant"
 ? "لوحة التحكم"
 : "لوحة الطالب"
 }
 href={
 user?.role === "admin"
 ? "/dashboard/overview"
 : user?.role === "assistant"
 ? "/dashboard/lectures"
 : "/userDashboard/overview"
 }
 className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pe-3 ps-1.5 transition-colors hover:bg-white/20"
 >
 <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FFB81C] text-sm font-black text-[#3D2C00]">
 {user?.firstName?.charAt(0) || "أ"}
 </span>
 <span className="text-sm font-bold text-white">
 {user?.firstName
 ? `أهلاً ${user.firstName}`
 : "لوحتي الدراسية"}
 </span>
 </Link>
 <LogoutBtn compact />
 </>
 ) : (
 <>
 <Link
 href="/login"
 className="inline-flex items-center justify-center rounded-xl border-2 border-white/25 bg-transparent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
 >
 تسجيل الدخول
 </Link>
 <Link
 href="/signup"
 className="inline-flex items-center justify-center rounded-xl border-2 border-[#FFB81C] bg-[#FFB81C] px-5 py-2.5 text-sm font-bold text-[#3D2C00] shadow-sm transition-all hover:bg-[#E9A400] hover:border-[#E9A400] active:scale-[0.98]"
 >
 إنشاء حساب
 </Link>
 </>
 )}
 </div>

 {/* Mobile toggle */}
 <div className="flex items-center gap-2 ms-auto md:hidden">
 <button
 onClick={toggleMobileMenu}
 aria-label={isOpen ? "إغلاق القائمة" : "فتح القائمة"}
 aria-expanded={isOpen}
 aria-controls={panelId}
 className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
 >
 {isOpen ? <IoClose size={22} /> : <RxHamburgerMenu size={20} />}
 </button>
 </div>
 </nav>

 {/* Mobile panel */}
 <div
 id={panelId}
 className={`grid md:hidden border-t border-white/10 bg-[#0A5A5F]/80 backdrop-blur-xl transition-[grid-template-rows,opacity,border-color] duration-300 ease-out will-change-[grid-template-rows] ${isOpen ? "grid-rows-[1fr] opacity-100 border-white/10" : "grid-rows-[0fr] opacity-0 border-transparent pointer-events-none"}`}
 aria-hidden={!isOpen}
 >
 <div className="overflow-hidden">
 <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
 <nav aria-label="قائمة الجوال" className="mb-3 grid gap-1">
 {NAV_LINKS.map((link) => {
 const active = isActive(link.href);
 return (
 <Link
 key={link.href + link.label}
 href={link.href}
 onClick={closeMenu}
 aria-current={active ? "page" : undefined}
 className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
 active
 ? "bg-[#FFB81C] text-[#3D2C00]"
 : "text-white/80 hover:bg-white/10 hover:text-white"
 }`}
 >
 {link.label}
 {active && (
 <span aria-hidden className="h-2 w-2 rounded-full bg-[#3D2C00]" />
 )}
 </Link>
 );
 })}
 </nav>
 {user ? (
 <div className="space-y-3">
 <Link
 href={
 user?.role === "admin"
 ? "/dashboard/overview"
 : user?.role === "assistant"
 ? "/dashboard/lectures"
 : "/userDashboard/overview"
 }
 onClick={closeMenu}
 className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3"
 >
 {user?.image?.cloudId ? (
 <Image
 src={`/api/upload/proxyImage/${encodeURIComponent(user.image.cloudId)}`}
 alt={user.firstName}
 width={40}
 height={40}
 className="h-10 w-10 rounded-full object-cover"
 sizes="40px"
 />
 ) : (
 <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFB81C] font-bold text-[#3D2C00]">
 {user?.firstName?.charAt(0)}
 </span>
 )}
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-bold text-white">
 {user?.firstName} {user?.lastName}
 </p>
 <p className="text-xs text-white/60">
 {user?.role === "admin"
 ? "مشرف"
 : user?.role === "assistant"
 ? "مساعد"
 : "طالب"}
 </p>
 </div>
 </Link>
 <div className="flex gap-2">
 <div className="flex-1">
 <LogoutBtn fullWidth />
 </div>
 </div>
 </div>
 ) : (
 <div className="grid gap-2">
 <Link
 href="/signup"
 onClick={closeMenu}
 className="inline-flex items-center justify-center rounded-xl border-2 border-[#FFB81C] bg-[#FFB81C] px-4 py-3.5 text-sm font-bold text-[#3D2C00]"
 >
 أنشئ حسابك الآن
 </Link>
 <Link
 href="/login"
 onClick={closeMenu}
 className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/25 bg-transparent px-4 py-3.5 text-sm font-bold text-white"
 >
 <LiaSignInAltSolid size={18} />
 تسجيل الدخول
 </Link>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
