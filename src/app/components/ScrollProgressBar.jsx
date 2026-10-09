"use client";

import { useEffect, useRef } from "react";

export default function ScrollProgressBar() {
  const barRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const bar = barRef.current;
    const wrap = wrapRef.current;
    if (!bar || !wrap) return;

    let raf = 0;
    let ticking = false;
    let lastVisible = false;

    const update = () => {
      ticking = false;
      const top = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const progress = h > 0 ? Math.min(1, Math.max(0, top / h)) : 0;
      // composite-only transform — no React re-render, no layout
      bar.style.transform = `scaleX(${progress})`;
      const visible = top > 10;
      if (visible !== lastVisible) {
        lastVisible = visible;
        wrap.style.opacity = visible ? "1" : "0";
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
    };

    // initial paint
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.75 bg-brand-navy/10 opacity-0 transition-opacity duration-300 will-change-[opacity]"
      style={{ opacity: 0 }}
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-brand-navy will-change-transform"
        style={{ transform: "scaleX(0)", transformOrigin: "left center" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-brand-teal to-transparent opacity-60"
        aria-hidden
      />
    </div>
  );
}
