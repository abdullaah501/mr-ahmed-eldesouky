"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

let registered = false;

/** Register shared GSAP plugins once (client only). Safe to call repeatedly. */
export function registerGsap() {
  if (registered) return;
  if (typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
  registered = true;
}

/** True when the user prefers reduced motion (SSR-safe, defaults to false). */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger };
