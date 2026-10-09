"use client";

import MathRenderer from "@/app/components/math/MathRenderer";

export default function EssayQuizRenderer({ question, register, isSubmitted, userAnswer, mode }) {
  if (mode === "review") {
    return (
      <div className="space-y-4">
        <div className="bg-foreground/[0.03] rounded-2xl p-4 sm:p-5 border border-foreground/10 space-y-4">
          <div>
            <p className="font-semibold text-foreground/70 text-xs mb-2">إجابتك:</p>
            <div className="bg-background p-4 rounded-xl border border-foreground/10 min-h-[80px]">
              <div className="text-foreground whitespace-pre-wrap text-sm sm:text-base">
                <MathRenderer text={userAnswer || "بانتظار التصحيح"} />
              </div>
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground/70 text-xs mb-2">الإجابة النموذجية:</p>
            <div className="bg-background p-4 rounded-xl border border-foreground/10 min-h-[80px]">
              <div className="text-foreground whitespace-pre-wrap text-sm sm:text-base">
                <MathRenderer text={question.correctAnswer || "غير متاحة"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={6}
        {...(register ? register(question._id, { required: true }) : {})}
        disabled={isSubmitted}
        className="w-full p-4 border-2 border-foreground/10 bg-background text-foreground rounded-2xl focus:border-primary focus:outline-none transition-all duration-200 resize-none text-sm sm:text-base placeholder:text-foreground/40"
        placeholder="اكتب إجابتك هنا..."
        defaultValue={userAnswer}
      />
      {isSubmitted && (
        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
          <p className="text-primary text-xs sm:text-sm font-medium">
            📝 إجابتك هتتصحح يدوياً من الأستاذ
          </p>
        </div>
      )}
    </div>
  );
}
