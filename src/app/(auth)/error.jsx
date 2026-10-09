"use client";

import Image from "next/image";
import { useEffect } from "react";
import Link from "next/link";
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex justify-center">
          <Image
            src="/logo.png"
            alt="أ. أحمد الدسوقي — مدرس كيمياء"
            width={44}
            height={44}
            className="h-[44px] w-[44px] object-contain"
          />
        </div>
        <h1 className="mt-4 text-lg font-extrabold text-text-primary">
          عذراً، حصل خطأ أثناء تنفيذ طلبك.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          مقدرناش نكمل العملية دلوقتي. حاول تاني أو ارجع للرئيسية.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-xl bg-brand-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover)"
          >
            حاول مرة أخرى
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-(--brand-navy-border) bg-brand-navy-soft px-6 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-navy hover:text-white"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
