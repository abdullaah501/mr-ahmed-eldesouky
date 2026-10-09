"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import {
  gsap,
  registerGsap,
  prefersReducedMotion,
} from "../../../../lib/anim";

/**
 * Reveal — subtle entrance wrapper (opacity + short rise, optional stagger).
 * - Renders children fully visible when JS/GSAP fails or reduced-motion is on.
 * - `as` controls the wrapper element. `delay`/`y` tune the motion.
 * - `scroll` uses ScrollTrigger (below-fold sections); default plays on mount.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  y = 14,
  scroll = false,
  ...rest
}) {
  const ref = useRef(null);

  useGSAP(
    () => {
      registerGsap();
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      const vars = {
        opacity: 0,
        y,
        duration: 0.55,
        delay,
        ease: "power2.out",
        overwrite: "auto",
      };
      if (scroll) {
        gsap.from(el, {
          ...vars,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      } else {
        gsap.from(el, vars);
      }
    },
    { scope: ref, dependencies: [] },
  );

  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
