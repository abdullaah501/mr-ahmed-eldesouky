"use client";

import { useId, useRef } from "react";
import { useGSAP } from "@gsap/react";
import {
 gsap,
 registerGsap,
 prefersReducedMotion,
} from "../../../../lib/anim";

/**
 * AtomOrbit — animated chemistry atom illustration.
 *
 * Features:
 * - Sequential orbit-drawing animation.
 * - Core electron travels ALONG its elliptical orbit (with a trailing arc).
 * - Secondary electrons travel along their own elliptical orbit.
 * - Soft, breathing nucleus and core glow.
 * - Instance-scoped GSAP animations (all tweens are created synchronously,
 * so they are cleaned up correctly on unmount / re-run).
 * - Respects reduced-motion preferences.
 *
 * Props:
 * - size: pixel dimension (default 200)
 * - variant: "dark" | "light"
 * - animated: play animations (default true)
 * - className: optional SVG class
 * - label: accessible image label
 */

const PALETTES = {
 dark: {
 ring: "rgba(143,227,228,0.55)",
 core: "#FFB81C",
 coreGlow: "rgba(255,184,28,0.35)",
 electron: "#2BBFC1",
 nucleus: "#8FE3E4",
 halo: "rgba(43,191,193,0.18)",
 },
 light: {
 ring: "rgba(11,81,85,0.45)",
 core: "#E9A400",
 coreGlow: "rgba(233,164,0,0.30)",
 electron: "#159A9C",
 nucleus: "#0B5155",
 halo: "rgba(21,154,156,0.14)",
 },
};

const TRAIL = 44; // length of the glowing arc that follows the core electron

/**
 * Returns a function place(p) that positions `mover` on `ring` at progress p
 * (0..1, wraps). If `trail` is given, its dash is kept just behind the mover.
 */
function makeOrbiter(ring, mover, trail) {
 const len = ring.getTotalLength();

 if (trail) {
 trail.setAttribute("stroke-dasharray", `${TRAIL} ${len - TRAIL}`);
 }

 return (p) => {
 const s = (((p % 1) + 1) % 1) * len;
 const pt = ring.getPointAtLength(s);

 mover.setAttribute("transform", `translate(${pt.x} ${pt.y})`);

 if (trail) {
 trail.setAttribute("stroke-dashoffset", String(TRAIL - s));
 }
 };
}

export default function AtomOrbit({
 size = 200,
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

 const rings = q(".ao-ring");
 const mainRing = q(".ao-ring-main")[0];
 const secRing = q(".ao-ring-sec")[0];
 const tracks = q(".ao-track");
 const cores = q(".ao-core");
 const coreGlows = q(".ao-core-glow");
 const electrons = q(".ao-electron");
 const nucleus = q(".ao-nucleus");

 const coreMover = q(".ao-mover-core")[0];
 const electronMover1 = q(".ao-mover-e1")[0];
 const electronMover2 = q(".ao-mover-e2")[0];
 const track = tracks[0];

 // Position helpers that move things along the real ellipse paths.
 const placeCore = makeOrbiter(mainRing, coreMover, track);
 const placeE1 = makeOrbiter(secRing, electronMover1);
 const placeE2 = makeOrbiter(secRing, electronMover2);

 // Starting positions.
 placeCore(0);
 placeE1(0);
 placeE2(0.5);

 // Static fallback for disabled animation or reduced-motion preference.
 if (!animated || prefersReducedMotion()) {
 gsap.set(rings, {
 strokeDasharray: "none",
 strokeDashoffset: 0,
 opacity: 1,
 });

 gsap.set(tracks, { opacity: 0.6 });
 gsap.set(cores, { opacity: 1 });
 gsap.set(coreGlows, { opacity: 1, scale: 1, transformOrigin: "0 0" });
 gsap.set(electrons, { opacity: 1 });
 gsap.set(nucleus, { opacity: 0.9, scale: 1, svgOrigin: "100 100" });

 return;
 }

 // Prepare the orbit rings for their draw-on effect.
 rings.forEach((ring) => {
 const length = ring.getTotalLength();

 gsap.set(ring, {
 strokeDasharray: length,
 strokeDashoffset: length,
 opacity: 1,
 });
 });

 // NOTE: glows/cores sit at (0,0) inside their mover group, so a
 // "0 0" origin scales them around their own centre. The nucleus is
 // scaled around the atom centre via svgOrigin. Setting the origin once,
 // up front, keeps it stable across the intro and the ambient tweens.
 gsap.set(tracks, { opacity: 0 });
 gsap.set(cores, { opacity: 0 });
 gsap.set(electrons, { opacity: 0 });
 gsap.set(coreGlows, { opacity: 0, scale: 0.8, transformOrigin: "0 0" });
 gsap.set(nucleus, { opacity: 0, scale: 0.8, svgOrigin: "100 100" });

 // Draw the orbit rings first.
 const intro = gsap.timeline();

 intro
 .to(rings, {
 strokeDashoffset: 0,
 duration: 1.1,
 stagger: 0.18,
 ease: "power2.inOut",
 })
 .to(
 tracks,
 { opacity: 0.6, duration: 0.5, ease: "power1.out" },
 "-=0.5",
 )
 .to(
 coreGlows,
 { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" },
 "-=0.3",
 )
 .to(cores, { opacity: 1, duration: 0.3 }, "<")
 .to(
 electrons,
 { opacity: 1, duration: 0.4, stagger: 0.1 },
 "-=0.3",
 )
 .to(
 nucleus,
 { opacity: 0.9, scale: 1, duration: 0.5, ease: "power2.out" },
 "-=0.25",
 );

 // Ambient motion starts once the intro has finished. These tweens are
 // created right now (not inside a delayed callback) so the GSAP context
 // owns them and reverts them properly; `delay` handles the timing.
 const t0 = intro.duration();

 // Core electron: one lap around the main ellipse.
 const core = { p: 0 };
 gsap.to(core, {
 p: 1,
 duration: 7,
 ease: "none",
 repeat: -1,
 delay: t0,
 onUpdate: () => placeCore(core.p),
 });

 // Secondary electron 1: opposite direction.
 const e1 = { p: 0 };
 gsap.to(e1, {
 p: -1,
 duration: 11,
 ease: "none",
 repeat: -1,
 delay: t0,
 onUpdate: () => placeE1(e1.p),
 });

 // Secondary electron 2: starts on the far side of the orbit.
 const e2 = { p: 0.5 };
 gsap.to(e2, {
 p: 1.5,
 duration: 14,
 ease: "none",
 repeat: -1,
 delay: t0,
 onUpdate: () => placeE2(e2.p),
 });

 // Pulsating glow around the main electron.
 gsap.to(coreGlows, {
 scale: 1.3,
 opacity: 0.55,
 duration: 1.6,
 repeat: -1,
 yoyo: true,
 ease: "sine.inOut",
 delay: t0,
 });

 // Soft breathing effect at the nucleus.
 gsap.to(nucleus, {
 scale: 1.12,
 duration: 2.4,
 repeat: -1,
 yoyo: true,
 ease: "sine.inOut",
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
 viewBox="0 0 200 200"
 width={size}
 height={size}
 className={className}
 role={label ? "img" : undefined}
 aria-hidden={label ? undefined : true}
 aria-label={label || undefined}
 >
 {label ? <title>{label}</title> : null}

 <defs>
 <radialGradient id={`ao-halo-${uid}`} cx="50%" cy="50%" r="50%">
 <stop offset="0%" stopColor={pal.halo} />
 <stop offset="100%" stopColor={pal.halo} stopOpacity="0" />
 </radialGradient>
 </defs>

 {/* Ambient halo */}
 <circle cx="100" cy="100" r="96" fill={`url(#ao-halo-${uid})`} />

 {/* MAIN ORBIT — moving core */}
 <g transform="rotate(-22 100 100)">
 <ellipse
 className="ao-ring ao-ring-main"
 cx="100"
 cy="100"
 rx="88"
 ry="34"
 fill="none"
 stroke={pal.ring}
 strokeWidth="3"
 />

 {/* Trailing arc; dash is positioned from JS to follow the electron */}
 <ellipse
 className="ao-track"
 cx="100"
 cy="100"
 rx="88"
 ry="34"
 fill="none"
 stroke={pal.core}
 strokeWidth="3"
 strokeLinecap="round"
 opacity="0.6"
 />

 {/* Drawn at (0,0); JS translates this group along the ellipse. */}
 <g className="ao-mover-core" transform="translate(188 100)">
 <circle
 className="ao-core-glow"
 cx="0"
 cy="0"
 r="15"
 fill={pal.coreGlow}
 />
 <circle
 className="ao-core"
 cx="0"
 cy="0"
 r="7"
 fill={pal.core}
 />
 <circle
 cx="0"
 cy="0"
 r="12"
 fill="none"
 stroke={pal.core}
 strokeWidth="1"
 opacity="0.45"
 />
 </g>
 </g>

 {/* SECONDARY ORBIT — electrons */}
 <g transform="rotate(38 100 100)">
 <ellipse
 className="ao-ring ao-ring-sec"
 cx="100"
 cy="100"
 rx="74"
 ry="28"
 fill="none"
 stroke={pal.ring}
 strokeWidth="1.5"
 opacity="0.7"
 />

 <g className="ao-mover-e1" transform="translate(174 100)">
 <circle
 className="ao-electron"
 cx="0"
 cy="0"
 r="4.5"
 fill={pal.electron}
 />
 </g>

 <g className="ao-mover-e2" transform="translate(26 100)">
 <circle
 className="ao-electron"
 cx="0"
 cy="0"
 r="3.5"
 fill={pal.electron}
 />
 </g>
 </g>

 {/* INNER ORBIT */}
 <g transform="rotate(-70 100 100)">
 <ellipse
 className="ao-ring"
 cx="100"
 cy="100"
 rx="58"
 ry="22"
 fill="none"
 stroke={pal.ring}
 strokeWidth="1.2"
 />
 </g>

 {/* Nucleus */}
 <circle
 className="ao-nucleus"
 cx="100"
 cy="100"
 r="9"
 fill={pal.nucleus}
 opacity="0.9"
 />
 </svg>
 );
}
