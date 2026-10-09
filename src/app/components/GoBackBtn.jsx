"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function GoBackBtn({ title = "العودة" }) {
  const router = useRouter();
  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };
  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-secondary transition-colors hover:border-(--brand-navy-border) hover:bg-brand-navy-soft hover:text-brand-navy active:scale-[0.98]"
    >
      <ArrowRight size={16} className="rotate-180" />
      {title}
    </button>
  );
}
