"use client";

import MathRenderer from "@/app/components/math/MathRenderer";

export default function MultipleChoiceQuizRenderer({ question, register, isSubmitted, userAnswer, mode }) {
 if (mode === "review") {
 const correctAnswer = question.correctAnswer;
 const isCorrect = question.isCorrect !== undefined ? question.isCorrect : true;
 return (
 <div className="space-y-3">
 {(question.options || []).map((opt) => {
 const isUserAnswer = userAnswer === opt.valueText;
 const isCorrectAnswer = correctAnswer === opt.valueText;
 return (
 <div
 key={opt._id || opt.valueText}
 className={`p-4 rounded-2xl border-2 transition-all duration-200 ${
 isCorrectAnswer
 ? "bg-green-500/10 border-green-500/40 text-green-600 shadow-sm"
 : isUserAnswer && !isCorrect
 ? "bg-red-500/10 border-red-500/40 text-red-600 shadow-sm"
 : "bg-foreground/[0.02] border-foreground/10 text-foreground/80"
 }`}
 >
 <div className="flex items-center justify-between gap-3">
 <span className="font-medium text-base sm:text-lg text-foreground">
 <MathRenderer text={opt.optionText || opt.valueText} />
 </span>
 <div className="flex items-center gap-2 flex-shrink-0">
 {isCorrectAnswer && (
 <span className="text-green-600 text-xs font-bold flex items-center gap-1 bg-green-500/15 px-2.5 py-1 rounded-full">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
 </svg>
 صحيحة
 </span>
 )}
 {isUserAnswer && !isCorrect && (
 <span className="text-red-600 text-xs font-bold flex items-center gap-1 bg-red-500/15 px-2.5 py-1 rounded-full">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 إجابتك
 </span>
 )}
 {isUserAnswer && isCorrectAnswer && (
 <span className="text-green-600 text-xs font-bold flex items-center gap-1 bg-green-500/15 px-2.5 py-1 rounded-full">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
 </svg>
 إجابتك
 </span>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {(question.options || []).map((option, optIdx) => (
 <label key={option._id || option.valueText} className="group cursor-pointer block">
 <input
 type="radio"
 value={option.valueText}
 {...(register ? register(question._id, { required: true }) : {})}
 disabled={isSubmitted}
 className="sr-only peer"
 />
 <div
 className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md
 border-foreground/10 bg-background text-foreground hover:border-primary/40 hover:bg-foreground/[0.03]
 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:shadow-sm
 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus)] peer-focus-visible:ring-offset-2
 peer-disabled:opacity-60 peer-disabled:cursor-not-allowed"
 >
 <span
 aria-hidden
 className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground/[0.06] text-base font-black text-foreground/60 transition-colors group-has-[:checked]:bg-primary group-has-[:checked]:text-white"
 >
 {["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"][optIdx] || optIdx + 1}
 </span>
 <span className="min-w-0 flex-1 text-base sm:text-lg font-medium">
 <MathRenderer text={option.optionText || option.valueText} />
 </span>
 </div>
 </label>
 ))}
 </div>
 );
}
