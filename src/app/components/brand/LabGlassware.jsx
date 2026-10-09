"use client";

import { useId, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, registerGsap, prefersReducedMotion } from "../../../../lib/anim";

/**
 * LabGlassware — animated chemistry lab illustration.
 *
 * Features:
 * - Animated glass outlines.
 * - Subtle liquid movement (fills and surfaces bob together).
 * - Rising bubbles that fade in, rise, fade out and loop seamlessly.
 * - Rotating molecule cluster.
 * - Proper SVG clipping.
 * - Multiple instances supported.
 * - Respects reduced-motion preferences.
 *
 * Props:
 * - size: pixel width (default 240)
 * - variant: "dark" | "light"
 * - animated: play animations (default true)
 * - className: optional SVG class
 * - label: accessible image label
 */

const PALETTES = {
 dark: {
 glass: "rgba(160,232,233,0.65)",
 liquid: "#2BBFC1",
 liquidDeep: "#0E7C7E",
 bubble: "#BFF3F3",
 molecule: "#FFB81C",
 molecule2: "#8FE3E4",
 },
 light: {
 glass: "rgba(11,81,85,0.55)",
 liquid: "#7FD4D6",
 liquidDeep: "#159A9C",
 bubble: "#FFFFFF",
 molecule: "#E9A400",
 molecule2: "#0B5155",
 },
};

const CONICAL =
 "M62 14 L62 50 L30 128 Q20 146 40 148 L100 148 Q120 146 110 128 L78 50 L78 14";

const TEST_TUBE = "M188 34 A8 8 0 0 1 204 34 L204 134 A8 8 0 0 1 188 134 Z";

// Each surface element keeps the opacity declared in its own attribute.
const attrOpacity = (_i, el) => Number(el.getAttribute("opacity")) || 1;

export default function LabGlassware({
 size = 240,
 variant = "dark",
 animated = true,
 className = "",
 label,
}) {
 const ref = useRef(null);
 const rawId = useId();
 const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
 const pal = PALETTES[variant] || PALETTES.dark;

 useGSAP(
 () => {
 registerGsap();

 const root = ref.current;

 if (!root) return;

 const q = gsap.utils.selector(root);

 const outlines = q(".lg-glass");
 const fills = q(".lg-fill");
 const surfaces = q(".lg-surface");
 const bubbles = q(".lg-bubble");
 const nodes = q(".lg-node");
 const moleculeClusters = q(".lg-spin");

 // Respect reduced motion while keeping all illustration elements visible.
 if (!animated || prefersReducedMotion()) {
 gsap.set(outlines, { strokeDasharray: "none", strokeDashoffset: 0 });
 gsap.set(fills, { opacity: 1, y: 0 });
 gsap.set(surfaces, { opacity: attrOpacity, y: 0 });
 gsap.set(bubbles, { opacity: 0 });
 gsap.set(nodes, { opacity: 1 });
 gsap.set(moleculeClusters, { rotation: 0 });

 return;
 }

 // Prepare each glass outline for its draw-on effect.
 outlines.forEach((outline) => {
 const length = outline.getTotalLength();

 gsap.set(outline, {
 strokeDasharray: length,
 strokeDashoffset: length,
 });
 });

 gsap.set(fills, { opacity: 0, y: 0 });
 gsap.set(surfaces, { opacity: 0, y: 0 });
 gsap.set(bubbles, { opacity: 0 });
 gsap.set(nodes, { opacity: 0 });
 gsap.set(moleculeClusters, { rotation: 0, svgOrigin: "160 96" });

 // Reveal animation.
 const reveal = gsap.timeline({ defaults: { ease: "power2.out" } });

 reveal
 .to(outlines, {
 strokeDashoffset: 0,
 duration: 1,
 stagger: 0.12,
 ease: "power2.inOut",
 })
 .to(fills, { opacity: 1, duration: 0.55, stagger: 0.08 }, "-=0.3")
 .to(
 surfaces,
 { opacity: attrOpacity, duration: 0.35, stagger: 0.06 },
 "-=0.2",
 )
 .to(nodes, { opacity: 1, duration: 0.35, stagger: 0.08 }, "-=0.15");

 // Ambient motion. Everything below is created synchronously (so the
 // GSAP context owns it and reverts it on unmount / re-run) and simply
 // starts after the reveal via `delay`.
 const t0 = reveal.duration();

 // Liquid: fills and surfaces share ONE tween so they never drift apart.
 gsap.to([...fills, ...surfaces], {
 y: -1.5,
 duration: 2.2,
 repeat: -1,
 yoyo: true,
 ease: "sine.inOut",
 delay: t0,
 });

 // Bubbles: fade in, rise, fade out, then loop without popping.
 bubbles.forEach((bubble, index) => {
 const startY = Number(bubble.getAttribute("cy")) || 140;
 const startX = Number(bubble.getAttribute("cx")) || 0;
 const travel = Number(bubble.dataset.travelDistance) || 58;
 const duration = 2.2 + (index % 3) * 0.25;
 const drift = (index % 2 === 0 ? 1 : -1) * 3;

 const tl = gsap.timeline({
 delay: t0 + index * 0.48,
 repeat: -1,
 repeatDelay: 0.35,
 });

 tl.fromTo(
 bubble,
 { attr: { cy: startY, cx: startX } },
 {
 attr: { cy: startY - travel, cx: startX + drift },
 duration,
 ease: "power1.out",
 },
 0,
 )
 .fromTo(
 bubble,
 { opacity: 0 },
 { opacity: 0.9, duration: duration * 0.2, ease: "none" },
 0,
 )
 .to(
 bubble,
 { opacity: 0, duration: duration * 0.3, ease: "none" },
 duration * 0.7,
 );
 });

 // Molecule cluster rotation.
 gsap.to(moleculeClusters, {
 rotation: 360,
 svgOrigin: "160 96",
 duration: 18,
 ease: "none",
 repeat: -1,
 delay: t0,
 });
 },
 {
 scope: ref,
 dependencies: [animated, variant],
 revertOnUpdate: true,
 },
 );

 return (
 <svg
 ref={ref}
 viewBox="0 0 240 170"
 width={size}
 height={(size * 170) / 240}
 className={className}
 role={label ? "img" : undefined}
 aria-hidden={label ? undefined : true}
 aria-label={label || undefined}
 >
 {label ? <title>{label}</title> : null}

 <defs>
 {/* Unique IDs prevent collisions between multiple instances. */}
 <clipPath id={`lg-conical-clip-${uid}`} clipPathUnits="userSpaceOnUse">
 <path d={CONICAL} />
 </clipPath>

 <clipPath id={`lg-bulb-clip-${uid}`} clipPathUnits="userSpaceOnUse">
 <circle cx="160" cy="96" r="36" />
 </clipPath>

 <clipPath id={`lg-tube-clip-${uid}`} clipPathUnits="userSpaceOnUse">
 <path d={TEST_TUBE} />
 </clipPath>

 <linearGradient id={`lg-liquid-${uid}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={pal.liquid} />
 <stop offset="100%" stopColor={pal.liquidDeep} />
 </linearGradient>
 </defs>

 {/* ERLENMEYER / CONICAL FLASK */}
 <g>
 <g clipPath={`url(#lg-conical-clip-${uid})`}>
 <rect
 className="lg-fill"
 x="18"
 y="104"
 width="104"
 height="50"
 fill={`url(#lg-liquid-${uid})`}
 />

 <ellipse
 className="lg-surface"
 cx="70"
 cy="104"
 rx="52"
 ry="5"
 fill={pal.liquid}
 opacity="0.9"
 />

 {[0, 1, 2].map((i) => (
 <circle
 key={`conical-bubble-${i}`}
 className="lg-bubble"
 cx={52 + i * 18}
 cy={140 - i * 6}
 r={3 - i * 0.5}
 fill={pal.bubble}
 opacity="0"
 data-travel-distance={52 + i * 4}
 />
 ))}
 </g>

 <path
 className="lg-glass"
 d={CONICAL}
 fill="none"
 stroke={pal.glass}
 strokeWidth="2.5"
 strokeLinejoin="round"
 />

 {/* Meniscus */}
 {/* <path
 className="lg-surface"
 d="M30 104 Q70 98 110 104"
 fill="none"
 stroke={pal.bubble}
 strokeWidth="1.5"
 opacity="0.8"
 /> */}
 </g>

 {/* ROUND-BOTTOM FLASK */}
 <g>
 <g clipPath={`url(#lg-bulb-clip-${uid})`}>
 <rect
 className="lg-fill"
 x="120"
 y="92"
 width="80"
 height="44"
 fill={`url(#lg-liquid-${uid})`}
 />

 <ellipse
 className="lg-surface"
 cx="160"
 cy="92"
 rx="36"
 ry="4"
 fill={pal.liquid}
 opacity="0.9"
 />

 {/* Molecule cluster */}
 <g className="lg-spin">
 <line
 x1="142"
 y1="106"
 x2="160"
 y2="94"
 stroke={pal.molecule2}
 strokeWidth="1.5"
 />
 <line
 x1="160"
 y1="94"
 x2="178"
 y2="108"
 stroke={pal.molecule2}
 strokeWidth="1.5"
 />
 <line
 x1="142"
 y1="106"
 x2="178"
 y2="108"
 stroke={pal.molecule2}
 strokeWidth="1"
 opacity="0.6"
 />

 <circle
 className="lg-node"
 cx="142"
 cy="106"
 r="4.5"
 fill={pal.molecule}
 opacity="0"
 />
 <circle
 className="lg-node"
 cx="160"
 cy="94"
 r="5.5"
 fill={pal.bubble}
 opacity="0"
 />
 <circle
 className="lg-node"
 cx="178"
 cy="108"
 r="4"
 fill={pal.molecule}
 opacity="0"
 />
 </g>

 {[0, 1].map((i) => (
 <circle
 key={`bulb-bubble-${i}`}
 className="lg-bubble"
 cx={147 + i * 23}
 cy={130 + i * 3}
 r={2.5}
 fill={pal.bubble}
 opacity="0"
 data-travel-distance={35 + i * 5}
 />
 ))}
 </g>

 <circle
 className="lg-glass"
 cx="160"
 cy="96"
 r="36"
 fill="none"
 stroke={pal.glass}
 strokeWidth="2.5"
 />

 {/* Neck — two separate paths so each draws on correctly */}
 <path
 className="lg-glass"
 d="M152 14 L152 60"
 fill="none"
 stroke={pal.glass}
 strokeWidth="2.5"
 strokeLinecap="round"
 />
 <path
 className="lg-glass"
 d="M168 14 L168 60"
 fill="none"
 stroke={pal.glass}
 strokeWidth="2.5"
 strokeLinecap="round"
 />
 </g>

 {/* TEST TUBE */}
 <g>
 <g clipPath={`url(#lg-tube-clip-${uid})`}>
 <rect
 className="lg-fill"
 x="188"
 y="104"
 width="16"
 height="40"
 rx="8"
 fill={`url(#lg-liquid-${uid})`}
 />

 <ellipse
 className="lg-surface"
 cx="196"
 cy="104"
 rx="7.5"
 ry="2"
 fill={pal.liquid}
 opacity="0.9"
 />

 <circle
 className="lg-bubble"
 cx="196"
 cy="136"
 r="2.5"
 fill={pal.bubble}
 opacity="0"
 data-travel-distance="30"
 />
 </g>

 <path
 className="lg-glass"
 d={TEST_TUBE}
 fill="none"
 stroke={pal.glass}
 strokeWidth="2.5"
 strokeLinejoin="round"
 />
 </g>
 </svg>
 );
}
