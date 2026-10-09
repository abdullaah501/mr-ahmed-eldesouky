"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { FiCopy, FiEye, FiEyeOff, FiRefreshCw, FiLink } from "react-icons/fi";
import { api } from "../../../../lib/axios/axios";

export default function GuardianLinkCard({ studentId }) {
  const [generated, setGenerated] = useState(null);
  const [showQr, setShowQr] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload = studentId ? { studentId } : {};
      const res = await api.post("/api/guardian/generate", payload);
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || "فشل إنشاء اللينك");
      }
      return res.data;
    },
    onSuccess: (data) => {
      setGenerated(data);
      setShowQr(false);
      toast.success("تم إنشاء اللينك");
    },
    onError: (err) => {
      toast.error(
        err?.message || "حصل خطأ أثناء إنشاء اللينك",
      );
    },
  });

  const handleCopy = async () => {
    if (!generated?.url) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      toast.success("تم نسخ اللينك");
    } catch {
      toast.error("فشل نسخ اللينك");
    }
  };

  return (
    <div
      className="bg-background rounded-2xl border border-foreground/10 p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <span className="bg-primary w-1 h-5 rounded-full" />
        <h3 className="font-bold text-foreground text-sm">ولي الأمر</h3>
      </div>

      <p className="text-xs text-foreground/60">
        ابعت اللينك ده لولي الأمر عشان يتابع مستواك ونتايج امتحاناتك. كل ما
        تعمل لينك جديد، القديم بيتلغي تلقائي.
      </p>

      <button
        type="button"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border-2 border-primary bg-primary text-white hover:bg-transparent hover:text-primary transition-all duration-300 active:scale-95 shadow-sm ${
          generateMutation.isPending ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <FiRefreshCw size={14} />
        {generateMutation.isPending
          ? "جاري إنشاء اللينك..."
          : generated
            ? "إنشاء لينك جديد"
            : "إنشاء لينك المتابعة"}
      </button>

      {generated?.url && (
        <div className="space-y-3 pt-2 border-t border-foreground/5">
          <div className="bg-foreground/[0.03] border border-foreground/10 rounded-xl p-3">
            <div className="flex items-center gap-2 text-foreground/40 mb-1.5">
              <FiLink size={12} />
              <span className="text-xs">اللينك</span>
            </div>
            <input
              type="text"
              readOnly
              value={generated.url}
              onFocus={(e) => e.target.select()}
              dir="ltr"
              className="w-full bg-background text-sm font-mono text-foreground border border-foreground/10 rounded-lg px-3 py-2 select-all focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors"
            >
              <FiCopy size={14} />
              نسخ اللينك
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors"
            >
              {showQr ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              {showQr ? "إخفاء الـ QR" : "عرض الـ QR"}
            </button>
          </div>

          {showQr && (
            <div className="flex justify-center bg-white p-4 rounded-xl border border-foreground/10">
              <QRCodeSVG
                value={generated.url}
                size={160}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
