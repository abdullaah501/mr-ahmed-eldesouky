"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import {
  gsap,
  registerGsap,
  prefersReducedMotion,
} from "../../../lib/anim";

export default function WhyChooseMeCard({ card, index }) {
  const ref = useRef(null);
  const Icon = card.icon;

  useGSAP(
    () => {
      registerGsap();
      if (prefersReducedMotion()) return;
      gsap.from(ref.current, {
        y: 16,
        opacity: 0,
        duration: 0.45,
        delay: index * 0.06,
        ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 90%", once: true },
      });
    },
    { scope: ref, dependencies: [] },
  );

  return (
    <div
      ref={ref}
      className="group flex h-full min-h-[220px] flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-(--brand-navy-border)"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy-soft text-brand-navy ring-1 ring-(--brand-navy-border) transition-colors group-hover:bg-brand-navy group-hover:text-white">
        {Icon ? <Icon size={19} aria-hidden /> : null}
      </span>
      <h3 className="mt-4 text-base font-extrabold text-text-primary">
        {card.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        {card.description}
      </p>
      <span className="mt-auto pt-4 text-xs font-bold text-brand-teal opacity-0 transition-opacity group-hover:opacity-100">
        — أ. أحمد الدسوقي
      </span>
    </div>
  );
}
