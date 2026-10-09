"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SideNavLink({
 link,
 onClick,
 tone = "light",
 className = "",
}) {
 const pathname = usePathname();
 const isActive = pathname === link.href;

 if (tone === "teal") {
 return (
 <Link
 href={link.href}
 onClick={onClick}
 aria-current={isActive ? "page" : undefined}
 className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors border ${isActive ? "bg-[var(--brand-amber)] text-[var(--brand-amber-ink)] border-[var(--brand-amber)] shadow-sm" : "bg-transparent text-white/75 border-transparent hover:bg-white/10 hover:text-white"} ${className}`}
 >
 <span
 className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-black/10 text-[var(--brand-amber-ink)]" : "bg-white/10 text-white"}`}
 >
 <link.icon size={16} />
 </span>
 <span className="flex-1 truncate">{link.title}</span>
 {isActive ? (
 <span
 className="h-2 w-2 rounded-full bg-[var(--brand-amber-ink)]"
 aria-hidden
 />
 ) : null}
 </Link>
 );
 }

 return (
 <Link
 href={link.href}
 onClick={onClick}
 aria-current={isActive ? "page" : undefined}
 className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors border ${isActive ? "bg-brand-navy text-white border-brand-navy shadow-sm" : "bg-transparent text-text-secondary border-transparent hover:bg-brand-navy-soft hover:text-brand-navy hover:border-(--brand-navy-border) "} ${className}`}
 >
 <span
 className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-white/16 text-white" : "bg-brand-navy-soft text-brand-navy "}`}
 >
 <link.icon size={16} />
 </span>
 <span className="flex-1 truncate">{link.title}</span>
 {isActive ? (
 <span
 className="h-2 w-2 rounded-full bg-brand-teal shadow-sm"
 aria-hidden
 />
 ) : null}
 </Link>
 );
}
