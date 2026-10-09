"use client";
import { forwardRef, useRef } from "react";
import gsap from "gsap";

const FloatingInput = forwardRef(
  (
    {
      id,
      name,
      label,
      oninput,
      type = "text",
      icon,
      className = "",
      inputMode,
      required,
      register,
      error,
      ...rest
    },
    ref,
  ) => {
    const barRef = useRef(null);
    const handleFocus = () => {
      const bar = barRef.current;
      if (!bar) return;
      gsap.killTweensOf(bar);
      gsap.fromTo(
        bar,
        { scaleX: 0, transformOrigin: "right center" },
        {
          scaleX: 1,
          duration: 0.32,
          ease: "power2.out",
          onComplete: () => {
            gsap.to(bar, {
              scaleX: 0,
              transformOrigin: "left center",
              duration: 0.32,
              delay: 0.35,
              ease: "power2.in",
            });
          },
        },
      );
    };

    return (
      <div className={className}>
        <div
          className="relative w-full rounded-xl border bg-card transition-colors focus-within:border-brand-navy focus-within:ring-4 focus-within:ring-ring"
          style={{ borderColor: error ? "var(--danger)" : "var(--border)" }}
        >
          <input
            id={id}
            type={type}
            placeholder=" "
            inputMode={inputMode}
            onInput={oninput}
            onFocus={handleFocus}
            ref={(el) => {
              if (typeof ref === "function") ref(el);
              else if (ref && typeof ref === "object") ref.current = el;
              const r = register?.ref;
              if (typeof r === "function") r(el);
              else if (r && typeof r === "object" && r !== null) r.current = el;
            }}
            {...(register
              ? (({ ref: _omit, ...restReg }) => restReg)(register)
              : {})}
            className="peer w-full bg-transparent px-4 py-3.5 pr-11 text-[15px] outline-none placeholder:text-transparent"
            aria-invalid={!!error}
            {...rest}
          />
          {icon ? (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted peer-focus:text-brand-navy">
              {icon}
            </span>
          ) : null}
          <label
            htmlFor={id}
            className="pointer-events-none absolute right-11 flex items-center gap-1 bg-card px-1 text-sm font-medium text-text-muted transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-bold peer-focus:text-brand-navy top-0 -translate-y-1/2 text-xs font-bold"
            style={{ top: 0 }}
          >
            {label}
            {required ? <span className="text-danger">*</span> : null}
          </label>
          <span
            ref={barRef}
            className="pointer-events-none absolute inset-0 rounded-xl bg-brand-navy/5 scale-x-0"
            aria-hidden
          />
        </div>
      </div>
    );
  },
);

FloatingInput.displayName = "FloatingInput";
export default FloatingInput;
