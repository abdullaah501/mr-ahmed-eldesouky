"use client";

import { useState } from "react";
import { HiChevronDown } from "react-icons/hi";

export default function SidebarSection({
  title,
  badge,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-4 py-3 text-brand-navy hover:bg-brand-navy hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold">{title}</span>
          {badge != null && (
            <span className="rounded-full bg-brand-navy px-2 py-0.5 text-xs font-bold text-white">
              {badge}
            </span>
          )}
        </div>
        <HiChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180 text-white" : "text-brand-navy"
          }`}
        />
      </button>
      {open && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}
