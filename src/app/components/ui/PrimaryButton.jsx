"use client";

export default function PrimaryButton({
  type = "button",
  disabled = false,
  onClick,
  children,
  className = "",
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3 font-bold text-white shadow-sm transition-all hover:bg-(--brand-navy-hover) hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
