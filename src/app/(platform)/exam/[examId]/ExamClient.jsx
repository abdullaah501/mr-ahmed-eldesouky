"use client";

import Quiz from "@/app/components/Quiz";
import GoBackBtn from "@/app/components/GoBackBtn";

export default function ExamClient({ exam, context, userId, draft }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <GoBackBtn title="رجوع" />
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-text-muted">
            أ. أحمد الدسوقي — الكيمياء
          </span>
        </div>
        <Quiz
          questions={exam?.questions || []}
          title={
            exam?.title ||
            (context?.gradeName ? `اختبار — ${context.gradeName}` : undefined)
          }
          userId={userId}
          examId={exam?._id}
          draft={draft}
        />
      </div>
    </div>
  );
}
