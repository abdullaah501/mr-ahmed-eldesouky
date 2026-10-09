const map = {
 navy: "bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border) ",
 teal: "bg-brand-teal-soft text-[#065f46] border border-[var(--brand-teal-border)] ",
 success:
 "bg-emerald-50 text-emerald-700 border border-emerald-200 ",
 warning:
 "bg-amber-50 text-amber-800 border border-amber-200 ",
 danger:
 "bg-red-50 text-red-700 border border-red-200 ",
 info: "bg-blue-50 text-blue-700 border border-blue-200 ",
 neutral: "bg-secondary text-muted border border-border",
};

export default function Badge({
 variant = "neutral",
 className = "",
 children,
 ...props
}) {
 return (
 <span
 className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold leading-none ${map[variant] || map.neutral} ${className}`}
 {...props}
 >
 {children}
 </span>
 );
}
