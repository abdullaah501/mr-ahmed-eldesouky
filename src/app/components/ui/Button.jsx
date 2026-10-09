"use client";

const variants = {
 primary:
 "bg-[var(--btn-bg)] text-white border-2 border-[var(--btn-bg)] hover:bg-[var(--btn-hover)] hover:border-[var(--btn-hover)] hover:shadow-[var(--shadow-brand-val)] focus-visible:ring-4 focus-visible:ring-ring",
 secondary:
 "bg-card text-brand-navy border-2 border-border hover:border-brand-navy hover:bg-brand-navy-soft ",
 teal: "bg-brand-teal text-white border-2 border-brand-teal hover:bg-[var(--brand-teal-hover)] hover:border-[var(--brand-teal-hover)] focus-visible:ring-4 focus-visible:ring-[rgba(16,185,129,0.18)]",
 ghost:
 "bg-transparent text-brand-navy border-2 border-transparent hover:bg-brand-navy-soft ",
 danger: "bg-danger text-white border-2 border-danger hover:brightness-110",
};

const sizes = {
 sm: "px-4 py-2 text-sm rounded-xl",
 md: "px-6 py-3 text-[15px] rounded-xl",
 lg: "px-8 py-3.5 text-base rounded-2xl",
};

export default function Button({
 variant = "primary",
 size = "md",
 isLoading = false,
 leftIcon,
 rightIcon,
 className = "",
 children,
 disabled,
 ...props
}) {
 return (
 <button
 disabled={disabled || isLoading}
 className={`inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
 {...props}
 >
 {isLoading ? (
 <>
 <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
 <span>Loading...</span>
 </>
 ) : (
 <>
 {leftIcon}
 {children}
 {rightIcon}
 </>
 )}
 </button>
 );
}
