"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const benefits = [
  { title: "طالب بيثق في المنصة", count: 1200, suffix: "+" },
  { title: "اختبار وتدريب", count: 350, suffix: "+" },
  { title: "متوسط رضا الطلاب", count: 96, suffix: "%" },
];

export default function BenefitsSection() {
  const container = useRef(null);

  useGSAP(
    () => {
      const numbers = gsap.utils.toArray(".benefit-number");
      numbers.forEach((num, i) => {
        const target = benefits[i].count;
        gsap.fromTo(
          num,
          { innerText: 0 },
          {
            innerText: target,
            duration: 1.6,
            snap: { innerText: 1 },
            ease: "power2.out",
            scrollTrigger: { trigger: container.current, start: "top 85%" },
          },
        );
      });
      gsap.from(".benefit-card", {
        y: 14,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: { trigger: container.current, start: "top 82%" },
      });
    },
    { scope: container },
  );

  return (
    <div ref={container} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="relative grid gap-4 overflow-hidden rounded-3xl border border-[#073B40] bg-gradient-to-bl from-[#073B40] to-[#0B5155] p-4 sm:grid-cols-3 sm:p-6 shadow-lg">
        <div
          className="chem-pattern pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
        />
        {benefits.map((b) => (
          <div
            key={b.title}
            className="benefit-card relative rounded-2xl bg-white/[0.07] px-6 py-7 text-center backdrop-blur border border-white/10"
          >
            <p
              dir="ltr"
              className="text-3xl font-black tracking-tight text-[#FFB81C] sm:text-4xl"
            >
              <span className="benefit-number">0</span>
              {b.suffix}
            </p>
            <p className="mt-1 text-sm font-bold text-white/90">{b.title}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs font-semibold tracking-wide text-text-muted">
        أرقام بتكبر معاك — كل اختبار بيقربك خطوة من التفوق.
      </p>
    </div>
  );
}
