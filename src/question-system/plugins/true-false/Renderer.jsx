"use client";

export default function TrueFalseQuizRenderer({ question, register, isSubmitted, userAnswer, mode }) {
 if (mode === "review") {
 const correctAnswer = question.correctAnswer;
 const isCorrect = question.isCorrect !== undefined ? question.isCorrect : true;
 return (
 <div className="space-y-3">
 {["true", "false"].map((val) => {
 const isUserAnswer = userAnswer === val;
 const isCorrectAnswer = correctAnswer === val;
 return (
 <div
 key={val}
 className={`p-4 rounded-2xl border-2 transition-all duration-200 ${
 isCorrectAnswer
 ? "bg-green-500/10 border-green-500/40 text-green-600 shadow-sm"
 : isUserAnswer && !isCorrect
 ? "bg-red-500/10 border-red-500/40 text-red-600 shadow-sm"
 : "bg-foreground/[0.02] border-foreground/10 text-foreground/80"
 }`}
 >
 <div className="flex items-center justify-between">
 <span className="font-medium text-base sm:text-lg text-foreground">
 {val === "true" ? "صح" : "خطأ"}
 </span>
 {isCorrectAnswer && (
 <span className="text-green-600 text-xs font-bold flex items-center gap-1 bg-green-500/15 px-2.5 py-1 rounded-full">
 ✓ صحيحة
 </span>
 )}
 {isUserAnswer && !isCorrect && (
 <span className="text-red-600 text-xs font-bold flex items-center gap-1 bg-red-500/15 px-2.5 py-1 rounded-full">
 ✗ إجابتك
 </span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {["true", "false"].map((val) => (
 <label key={val} className="group cursor-pointer block">
 <input
 type="radio"
 value={val}
 {...(register ? register(question._id, { required: true }) : {})}
 disabled={isSubmitted}
 className="sr-only peer"
 />
 <div
 className="p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md
 border-foreground/10 bg-background text-foreground hover:border-primary/40 hover:bg-foreground/[0.03]
 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-checked:shadow-sm
 peer-disabled:opacity-60 peer-disabled:cursor-not-allowed"
 >
 <span className="text-base sm:text-lg font-medium">
 {val === "true" ? "True" : "False"}
 </span>
 </div>
 </label>
 ))}
 </div>
 );
}
