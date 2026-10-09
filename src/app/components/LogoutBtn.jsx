"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LogOut } from "lucide-react";
import { performClientLogout } from "../../../lib/auth/clientSync";

export default function LogoutBtn({ compact = false, fullWidth = false }) {
 const router = useRouter();
 const queryClient = useQueryClient();
 const handleLogout = async () => {
 const res = await performClientLogout({ router, queryClient });
 toast.success(res?.data?.message || "تم تسجيل الخروج");
 };
 return (
 <button
 onClick={handleLogout}
 className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition-colors active:scale-[0.98] ${compact ? "h-9 px-4 text-sm border-border bg-card text-text-secondary hover:border-brand-navy hover:text-brand-navy" : "px-4 py-2.5 text-sm border-(--brand-navy-border) bg-brand-navy-soft text-brand-navy hover:bg-brand-navy hover:text-white hover:border-brand-navy "} ${fullWidth ? "w-full" : "w-fit"}`}
 >
 <LogOut size={16} />
 تسجيل الخروج
 </button>
 );
}
