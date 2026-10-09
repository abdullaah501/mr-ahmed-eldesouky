"use client";
import { useForm } from "react-hook-form";
import { api } from "../../../../lib/axios/axios";
import { useState } from "react";
import {
 FaEnvelope,
 FaMapMarkerAlt,
 FaPaperPlane,
} from "react-icons/fa";
import { FiFacebook, FiInstagram } from "react-icons/fi";
import { FaTiktok, FaYoutube } from "react-icons/fa6";
import Link from "next/link";
import { TEACHER_SOCIALS } from "../brand/teacherBrand";

export default function ContactForm() {
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm();
 const [state, setState] = useState({ success: false, message: "" });
 const { success, message } = state;
 const onSubmit = async (data) => {
 setState({ success: false, message: "" });
 try {
 const res = await api.post("/api/cron-job/sendEmail", {
 to: "pixelpulse845@gmail.com",
 name: data.name,
 email: data.email,
 phone: data.phone,
 subject: data.subject,
 message: data.message,
 });
 const result = res.data;
 if (!result.success)
 throw new Error(result.message || "حدث خطأ ما");
 setState({ success: true, message: "تم إرسال رسالتك بنجاح" });
 reset();
 } catch (err) {
 setState({
 success: false,
 message:
 err.response?.data?.message || err.message || "حدث خطأ ما",
 });
 }
 };

 const contactDetails = [
 {
 icon: (
 <FiFacebook
 className="text-[var(--brand-navy)] group-hover:text-white transition-colors duration-300"
 size={18}
 />
 ),
 title: "فيسبوك",
 value: "Mr.DesoukyChemistry",
 link: TEACHER_SOCIALS.facebook,
 },
 {
 icon: (
 <FiInstagram
 className="text-[var(--brand-navy)] group-hover:text-white transition-colors duration-300"
 size={18}
 />
 ),
 title: "انستجرام",
 value: "eldesouky726",
 link: TEACHER_SOCIALS.instagram,
 },
 {
 icon: (
 <FaTiktok
 className="text-[var(--brand-navy)] group-hover:text-white transition-colors duration-300"
 size={18}
 />
 ),
 title: "تيك توك",
 value: "ahmed.eldesouky71",
 link: TEACHER_SOCIALS.tiktok,
 },
 {
 icon: (
 <FaYoutube
 className="text-[var(--brand-navy)] group-hover:text-white transition-colors duration-300"
 size={18}
 />
 ),
 title: "يوتيوب",
 value: "قناة أ. أحمد الدسوقي",
 link: TEACHER_SOCIALS.youtube,
 },
 {
 icon: (
 <FaEnvelope
 className="text-[var(--brand-navy)] group-hover:text-white transition-colors duration-300"
 size={18}
 />
 ),
 title: "ابعت رسالة",
 value: "من خلال الفورم",
 link: "#contact-form",
 },
 {
 icon: (
 <FaMapMarkerAlt
 className="text-[var(--brand-navy)] group-hover:text-white transition-colors duration-300"
 size={18}
 />
 ),
 title: "المكان",
 value: "الإسماعيلية، مصر",
 link: "#",
 },
 ];

 const inputCls =
 "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-navy)] focus:ring-4 focus:ring-[var(--ring)] focus:outline-none transition-all";

 return (
 <div className="mx-auto max-w-6xl">
 <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
 <div className="lg:col-span-5 flex flex-col gap-4">
 {contactDetails.map((detail, index) => (
 <Link
 key={index}
 href={detail.link}
 target={detail.link !== "#" ? "_blank" : undefined}
 rel="noopener noreferrer"
 className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-navy-border)] hover:shadow-md"
 >
 <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-navy-soft)] border border-[var(--brand-navy-border)] group-hover:bg-[var(--brand-navy)] transition-colors duration-300 shrink-0">
 {detail.icon}
 </span>
 <div className="text-right min-w-0">
 <h3 className="text-xs font-extrabold text-[var(--text-muted)]">
 {detail.title}
 </h3>
 <p className="mt-1 truncate text-sm font-extrabold text-[var(--text-primary)] group-hover:text-[var(--brand-navy)]">
 {detail.value}
 </p>
 </div>
 </Link>
 ))}
 <div className="rounded-2xl border border-[var(--brand-navy-border)] bg-[var(--brand-navy-soft)] p-5">
 <p className="text-sm font-extrabold text-[var(--brand-navy)]">
 مواعيد التواصل
 </p>
 <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
 بنرد خلال ٢٤ ساعة — الكيمياء بثقة ومن غير تعقيد.
 </p>
 </div>
 </div>

 <div
 id="contact-form"
 className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
 >
 <div className="mb-6 flex items-center gap-3">
 <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-navy)] text-white">
 <FaPaperPlane size={14} className="-scale-x-100" />
 </span>
 <div>
 <h2 className="text-base font-extrabold text-[var(--text-primary)]">
 ابعتلنا رسالة
 </h2>
 <p className="text-xs font-medium text-[var(--text-muted)]">
 هنرد عليك في أقرب وقت ممكن
 </p>
 </div>
 </div>
 <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-primary)]">
 الاسم
 </label>
 <input
 type="text"
 placeholder="اسمك بالكامل"
 className={inputCls}
 {...register("name", {
 required: "الاسم مطلوب",
 minLength: {
 value: 2,
 message: "الاسم لازم يكون حرفين على الأقل",
 },
 })}
 />
 {errors.name && (
 <p className="mt-1 text-xs font-bold text-red-600">
 {errors.name.message}
 </p>
 )}
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-primary)]">
 البريد الإلكتروني
 </label>
 <input
 type="email"
 placeholder="name@example.com"
 className={`${inputCls} ltr-field`}
 style={{ direction: "ltr" }}
 {...register("email", {
 required: "البريد الإلكتروني مطلوب",
 pattern: {
 value: /^\S+@\S+$/i,
 message: "صيغة البريد الإلكتروني غير صحيحة",
 },
 })}
 />
 {errors.email && (
 <p className="mt-1 text-xs font-bold text-red-600">
 {errors.email.message}
 </p>
 )}
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-primary)]">
 رقم الموبايل
 </label>
 <input
 type="text"
 placeholder="01xxxxxxxxx"
 className={`${inputCls} ltr-field`}
 {...register("phone", {
 minLength: {
 value: 10,
 message: "رقم الموبايل لازم يكون ١٠ أرقام على الأقل",
 },
 })}
 />
 {errors.phone && (
 <p className="mt-1 text-xs font-bold text-red-600">
 {errors.phone.message}
 </p>
 )}
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-primary)]">
 الموضوع
 </label>
 <input
 type="text"
 placeholder="موضوع استفسارك"
 className={inputCls}
 {...register("subject", {
 required: "الموضوع مطلوب",
 minLength: {
 value: 3,
 message: "الموضوع لازم يكون ٣ حروف على الأقل",
 },
 })}
 />
 {errors.subject && (
 <p className="mt-1 text-xs font-bold text-red-600">
 {errors.subject.message}
 </p>
 )}
 </div>
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-extrabold text-[var(--text-primary)]">
 الرسالة
 </label>
 <textarea
 placeholder="اكتب تفاصيل استفسارك هنا..."
 className={`${inputCls} min-h-[120px]`}
 rows={5}
 {...register("message", {
 required: "الرسالة مطلوبة",
 minLength: {
 value: 5,
 message: "الرسالة لازم تكون ٥ حروف على الأقل",
 },
 })}
 />
 {errors.message && (
 <p className="mt-1 text-xs font-bold text-red-600">
 {errors.message.message}
 </p>
 )}
 </div>
 <button
 type="submit"
 disabled={isSubmitting}
 className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-navy)] px-6 py-3.5 text-sm font-bold text-white hover:bg-[var(--brand-navy-hover)] disabled:opacity-50 shadow-sm"
 >
 {isSubmitting ? (
 <>
 <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />{" "}
 جاري الإرسال...
 </>
 ) : (
 <>
 ابعت الرسالة{" "}
 <FaPaperPlane size={14} className="-scale-x-100" />
 </>
 )}
 </button>
 </form>
 {message && (
 <div
 className={`mt-4 rounded-xl border p-3 text-center text-sm font-bold ${success ? "border-emerald-200 bg-emerald-50 text-emerald-700 " : "border-red-200 bg-red-50 text-red-700 "}`}
 >
 {message}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
