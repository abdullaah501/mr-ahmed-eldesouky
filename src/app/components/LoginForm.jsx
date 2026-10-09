"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { MdAlternateEmail } from "react-icons/md";
import { RiLockPasswordFill } from "react-icons/ri";
import { FaArrowRight } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import FloatingInput from "@/app/components/FloatingInput";
import validator from "validator";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import getFingerprint from "../../../lib/getFingerprint";
import { useUserStore } from "../../../stores/user";
import { invalidateAuth, broadcastAuth } from "../../../lib/auth/clientSync";

export default function LoginForm() {
 const router = useRouter();
 const queryClient = useQueryClient();
 const [error, setError] = useState("");
 const setUser = useUserStore((s) => s.setUser);

 const {
 register,
 handleSubmit,
 formState: { errors, isSubmitting },
 } = useForm();

 const onSubmit = async (data) => {
 setError("");
 const fingerprint = await getFingerprint();
 try {
 const res = await axios.post("/api/auth/login", { ...data, fingerprint });
 const { role, user } = res.data;
 invalidateAuth(queryClient);
 if (user) setUser(user);
 broadcastAuth("login");
 router.refresh();
 router.push(
 role === "admin"
 ? "/dashboard/overview"
 : role === "assistant"
 ? "/dashboard/lectures"
 : "/userDashboard/overview",
 );
 } catch (err) {
 setError(err.response?.data?.message || "فشل تسجيل الدخول");
 }
 };

 return (
 <div className="flex min-h-[calc(100dvh-68px)] bg-background px-3 py-6 sm:px-6 sm:py-8">
 <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:gap-4">
 {/* Form */}
 <div className="flex flex-1 items-center justify-center order-2 lg:order-1">
 <div className="w-full max-w-130">
 <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
 <div className="mb-6 flex justify-center lg:hidden">
 <Image
 src="/logo.png"
 alt="أ. أحمد الدسوقي — مدرس كيمياء"
 width={36}
 height={36}
 className="h-[36px] w-[36px] object-contain"
 />
 </div>
 <div className="mb-6 text-center">
 <h1 className="text-xl font-extrabold text-text-primary sm:text-2xl">
 أهلاً بعودتك — جاهز للكيمياء؟
 </h1>
 <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
 سجّل الدخول عشان توصل لاختباراتك وتتابع مستواك.
 </p>
 </div>

 <form
 onSubmit={handleSubmit(onSubmit)}
 className="flex flex-col gap-4"
 >
 <div>
 <FloatingInput
 id="emailOrPhone"
 label="البريد الإلكتروني أو رقم الموبايل"
 type="text"
 icon={<MdAlternateEmail size={16} />}
 register={register("emailOrPhone", {
 required: "البريد الإلكتروني مطلوب",
 validate: (v) =>
 validator.isEmail(v) ||
 validator.isMobilePhone(v, "any") ||
 "البريد الإلكتروني أو رقم الموبايل غير صحيح",
 })}
 error={errors.emailOrPhone}
 />
 {errors.emailOrPhone && (
 <p className="mt-1.5 text-xs font-semibold text-danger">
 {errors.emailOrPhone.message}
 </p>
 )}
 </div>

 <div>
 <FloatingInput
 id="password"
 label="كلمة السر"
 type="password"
 icon={<RiLockPasswordFill size={16} />}
 register={register("password", {
 required: "كلمة السر مطلوبة",
 })}
 error={errors.password}
 />
 {errors.password && (
 <p className="mt-1.5 text-xs font-semibold text-danger">
 {errors.password.message}
 </p>
 )}
 </div>

 <div className="-mt-1 text-right">
 <Link
 href="/forget-password"
 className="text-xs font-bold text-brand-navy hover:underline"
 >
 نسيت كلمة السر؟
 </Link>
 </div>

 {error && (
 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700 ">
 {error}
 </div>
 )}

 <button
 type="submit"
 disabled={isSubmitting}
 className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-(--brand-navy-hover) hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isSubmitting ? (
 <>
 <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
 جاري تسجيل الدخول...
 </>
 ) : (
 <>
 تسجيل الدخول
 <FaArrowRight size={14} />
 </>
 )}
 </button>
 </form>

 <p className="mt-6 text-center text-sm text-text-muted">
 معندكش حساب؟{" "}
 <Link
 href="/signup"
 className="font-extrabold text-brand-navy hover:underline"
 >
 اعمل حسابك دلوقتي
 </Link>
 </p>
 <p className="mt-4 text-center text-xs">
 <Link
 href="/"
 className="inline-flex items-center gap-1 font-semibold text-text-muted hover:text-brand-navy"
 >
 <FaArrowRight size={10} className="flip-rtl" />
 العودة للرئيسية
 </Link>
 </p>
 </div>
 </div>
 </div>

 {/* Brand panel */}
 <div className="flex flex-1 items-center justify-center p-2 order-1 lg:order-2">
 <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
 <div className="h-1 w-full bg-gradient-to-l from-[var(--brand-amber)] to-[var(--brand-teal)]" />
 <div className="bg-[var(--background)] p-3 sm:p-4">
 <Image
 src="/login.jpeg"
 alt="تسجيل الدخول — أ. أحمد الدسوقي"
 width={700}
 height={700}
 className="w-full h-auto object-contain rounded-2xl"
 priority
 />
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
