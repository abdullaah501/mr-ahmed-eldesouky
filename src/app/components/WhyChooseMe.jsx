"use client";
import WhyChooseMeCard from "./WhyChooseMeCard";
import Link from "next/link";
import {
 LuFlaskConical,
 LuAtom,
 LuTarget,
 LuSparkles,
 LuArrowLeft,
} from "react-icons/lu";

const cards = [
 {
 title: "اختبارات دقيقة",
 description:
 "أسئلة مختارة بعناية بتقيس فهمك الحقيقي للكيمياء، مع تصحيح فوري ودرجة واضحة لكل اختبار.",
 icon: LuFlaskConical,
 },
 {
 title: "متابعة مستواك",
 description:
 "اعرف مستواك بعد كل اختبار وشوف تقدمك على لوحة بسيطة بتشجعك تكمل.",
 icon: LuAtom,
 },
 {
 title: "تدريبات مركزة",
 description:
 "تدريبات قصيرة تساعدك تتقن القاعدة وتحل أسرع وبثقة في الامتحان.",
 icon: LuTarget,
 },
 {
 title: "محتوى منظم لصفك",
 description:
 "المحتوى متقسم حسب صفك الدراسي — اختار صفك ووصل للمحتوى المناسب ليك على طول.",
 icon: LuSparkles,
 },
];

export default function WhyChooseMe() {
 return (
 <section
 id="teacher"
 className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
 >
 <div className="grid gap-10 lg:grid-cols-[0.85fr_1.35fr] lg:gap-14">
 {/* Sticky editorial intro */}
 <div className="lg:sticky lg:top-24 lg:self-start">
 <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-amber-border)] bg-[var(--brand-amber-soft)] px-3 py-1 text-xs font-extrabold text-[#7A5200] ">
 <span
 aria-hidden
 className="h-1.5 w-1.5 rounded-full bg-[var(--brand-amber)]"
 />
 ليه منصة أ. أحمد الدسوقي؟
 </p>
 <h2 className="mt-4 text-3xl font-black leading-snug text-text-primary sm:text-4xl">
 مدرس كيمياء
 <br />
 بيشرح{" "}
 <span className="relative inline-block">
 بطريقة واضحة
 <span
 aria-hidden
 className="absolute inset-x-0 -bottom-1 h-[6px] rounded-full bg-[var(--brand-amber)]/60"
 />
 </span>
 </h2>
 <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted sm:text-base">
 أ. أحمد الدسوقي بيبسّط المفاهيم، وبيساعدك تتدرب وتحل كتير وتستعد
 للامتحان بمحتوى منظم — شرح ودروس واختبارات ومراجعات في مكان واحد.
 </p>
 <div className="mt-6 flex flex-wrap gap-3">
 <Link
 href="/signup"
 className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--brand-amber)] bg-[var(--brand-amber)] px-6 py-3 text-sm font-extrabold text-[var(--brand-amber-ink)] transition-all hover:bg-[var(--brand-amber-hover)] hover:border-[var(--brand-amber-hover)] active:scale-[0.98]"
 >
 ابدأ دلوقتي
 <span aria-hidden>
 <LuArrowLeft size={14} />
 </span>
 </Link>
 <Link
 href="/#grades"
 className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-6 py-3 text-sm font-bold text-text-secondary transition-colors hover:border-[var(--brand-navy)] hover:text-[var(--brand-navy)]"
 >
 اختار صفك
 </Link>
 </div>
 </div>

 {/* Numbered cards */}
 <ol className="grid gap-4 sm:grid-cols-2">
 {cards.map((c, i) => (
 <li key={c.title} className="relative">
 <span
 className="pointer-events-none absolute -top-3 right-4 z-10 rounded-full bg-[#073B40] px-2.5 py-0.5 text-[11px] font-black text-[#FFB81C] "
 >
 {String(i + 1).padStart(2, "0")}
 </span>
 <WhyChooseMeCard card={c} index={i} />
 </li>
 ))}
 </ol>
 </div>
 </section>
 );
}
