"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, registerGsap, prefersReducedMotion } from "../../../../lib/anim";

/**
 * MetricRing — circular progress ring that fills and counts up when it scrolls
 * into view. Pure presentational: every value is supplied by the caller, and the
 * final numbers are rendered server-side so they read correctly without JS.
 */
export default function MetricRing({
  value,
  max,
  center,
  label,
  sub,
  tone = "teal",
  dimmed = false,
}) {
  const ref = useRef(null);
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = tone === "amber" ? "var(--brand-amber)" : "var(--brand-teal)";
  const raw = String(center);
  // "72%" -> count 72, keep "%" | "4/5" -> count 4, keep "/5" | "12" -> count 12
  const match = raw.match(/^(-?\d+)(.*)$/);

  useGSAP(
    () => {
      registerGsap();
      const root = ref.current;
      if (!root) return;
      if (prefersReducedMotion()) return;

      const arc = root.querySelector(".mr-arc");
      const readout = root.querySelector(".mr-value");
      if (!arc || !readout) return;

      gsap.set(arc, { strokeDasharray: c, strokeDashoffset: c });

      // The timeline is paused and only played once the ring scrolls into view,
      // so an off-screen ring keeps its real server-rendered value instead of
      // flashing "0" while it waits.
      const timeline = gsap
        .timeline({ paused: true })
        .to(
          arc,
          {
            strokeDashoffset: c * (1 - pct / 100),
            duration: 1.2,
            ease: "power2.out",
          },
          0,
        );

      if (match) {
        const target = parseFloat(match[1]);
        const rest = match[2];
        timeline.to(
          readout,
          {
            innerText: target,
            duration: 1.2,
            ease: "power1.out",
            snap: { innerText: 1 },
            onUpdate() {
              readout.textContent = `${Math.round(
                parseFloat(this.targets()[0].innerText),
              )}${rest}`;
            },
          },
          0,
        );
      }

      ScrollTrigger.create({
        trigger: root,
        start: "top 88%",
        once: true,
        onEnter: () => timeline.play(),
      });
    },
    { scope: ref, dependencies: [pct, raw, c] },
  );

  return (
    <div
      ref={ref}
      className="flex flex-col items-center gap-2"
      style={dimmed ? { opacity: 0.7 } : undefined}
    >
      <div
        className="relative h-[86px] w-[86px]"
        role="img"
        aria-label={`${label} ${center}`}
      >
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth="7"
          />
          <circle
            className="mr-arc"
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
          />
        </svg>
        <span
          dir="ltr"
          className="mr-value absolute inset-0 grid place-items-center text-lg font-black tabular-nums text-text-primary"
        >
          {center}
        </span>
      </div>
      <p className="text-[13px] font-black text-text-primary">{label}</p>
      <p className="text-[11px] font-bold text-text-muted">{sub}</p>
    </div>
  );
}