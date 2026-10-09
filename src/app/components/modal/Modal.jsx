"use client";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Image from "next/image";

const SIZE_CLASSES = {
  md: "max-w-lg",
  xl: "max-w-3xl",
};

export default function Modal({ isOpen, onClose, children, title, size = "md" }) {
  if (!isOpen) return null;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${sizeClass} flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-teal)] opacity-90" />
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-[var(--background)]/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand-navy-soft)] border border-[var(--brand-navy-border)] shrink-0">
              <Image src="/logo.png" alt="أ. أحمد الدسوقي — مدرس كيمياء" width={20} height={20} className="h-5 w-5 object-contain" />
            </span>
            {title ? <h2 className="truncate text-base font-extrabold text-[var(--text-primary)]">{title}</h2> : <span />}
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-[var(--text-muted)] hover:bg-[var(--brand-navy-soft)] hover:border-[var(--brand-navy-border)] hover:text-[var(--brand-navy)] transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-card">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
