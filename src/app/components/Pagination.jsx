import React from "react";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";

export default function Pagination({ totalPages, currentPage, onPageChange }) {
 if (!totalPages || totalPages < 2) return null;
 const pages = [...Array(totalPages)].map((_, i) => i + 1);
 return (
 <nav
 aria-label="ترقيم الصفحات"
 className="mt-6 mb-4 flex flex-wrap items-center justify-center gap-2"
 >
 <button
 type="button"
 disabled={currentPage === 1}
 onClick={() => onPageChange(currentPage - 1)}
 className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3.5 py-2 text-[13px] font-bold text-text-secondary transition-colors hover:border-[var(--brand-navy-border)] hover:text-[var(--brand-navy)] disabled:cursor-not-allowed disabled:opacity-40"
 >
 <span aria-hidden><LuArrowRight size={13} /></span> السابق
 </button>
 <div className="flex items-center gap-1.5">
 {pages.map((page) => (
 <button
 key={page}
 type="button"
 disabled={currentPage === page}
 onClick={() => onPageChange(page)}
 aria-current={currentPage === page ? "page" : undefined}
 aria-label={`صفحة ${page}`}
 className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-black tabular-nums transition-colors ${
 currentPage === page
 ? "bg-[#073B40] text-white shadow-sm "
 : "border border-border bg-card text-text-secondary hover:border-[var(--brand-navy-border)] hover:text-[var(--brand-navy)]"
 }`}
 >
 {page}
 </button>
 ))}
 </div>
 <button
 type="button"
 disabled={currentPage === totalPages}
 onClick={() => onPageChange(currentPage + 1)}
 className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3.5 py-2 text-[13px] font-bold text-text-secondary transition-colors hover:border-[var(--brand-navy-border)] hover:text-[var(--brand-navy)] disabled:cursor-not-allowed disabled:opacity-40"
 >
 التالي <span aria-hidden><LuArrowLeft size={13} /></span>
 </button>
 </nav>
 );
}
