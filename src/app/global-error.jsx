"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <h1 className="mt-2 text-lg font-extrabold text-text-primary">
              عذراً، حصل خطأ غير متوقع.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              حصل خطأ أثناء تشغيل التطبيق. من فضلك حاول مرة أخرى.
            </p>
            <button
              onClick={() => reset()}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover)"
            >
              حاول مرة أخرى
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
