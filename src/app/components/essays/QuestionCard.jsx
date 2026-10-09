"use client";
import { FaRegTimesCircle, FaTimesCircle } from "react-icons/fa";
import { useState } from "react";
import { IoCheckmarkCircleOutline, IoCheckmarkCircle } from "react-icons/io5";
import Image from "next/image";

export default function QuestionCard({ questions, handleCount, currentType }) {
  const [showAnswer, setShowAnswer] = useState({
    0: { correct: false, wrong: false },
  });
  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="bg-brand-navy-soft p-4 border-b border-(--brand-navy-border)">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-navy text-white text-sm font-black shrink-0">
                {index + 1}
              </span>
              <h3 className="text-sm font-bold leading-relaxed text-text-primary">
                {question.question}
              </h3>
            </div>
            {question.image?.url && (
              <div className="mt-3 flex justify-center">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <Image
                    src={`/api/upload/proxyImage/${encodeURIComponent(question.image?.cloudId)}`}
                    width={220}
                    height={220}
                    alt="صورة السؤال"
                    className="max-h-[220px] w-auto object-contain"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="bg-background p-4 border-b border-border">
            <div className="flex items-start gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-navy text-white text-xs font-black shrink-0">
                A
              </span>
              <p className="text-sm font-medium leading-relaxed text-text-secondary">
                {question.answer}
              </p>
            </div>
          </div>
          <div className="bg-card p-4">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleCount("correct", question._id);
                    setShowAnswer((p) => ({
                      ...p,
                      [index]: { correct: true, wrong: false },
                    }));
                  }}
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-all hover:scale-105 active:scale-95 ${showAnswer[index]?.correct ? "bg-emerald-500 border-emerald-500 text-white shadow-md" : "bg-card border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                >
                  {showAnswer[index]?.correct ? (
                    <IoCheckmarkCircle size={22} />
                  ) : (
                    <IoCheckmarkCircleOutline size={22} />
                  )}
                </button>
                <span className="text-xs font-bold text-emerald-700">صح</span>
              </div>
              <span className="h-10 w-px bg-border" />
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleCount("wrong", question._id);
                    setShowAnswer((p) => ({
                      ...p,
                      [index]: { correct: false, wrong: true },
                    }));
                  }}
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-all hover:scale-105 active:scale-95 ${showAnswer[index]?.wrong ? "bg-red-500 border-red-500 text-white shadow-md" : "bg-card border-red-200 text-red-600 hover:bg-red-50"}`}
                >
                  {showAnswer[index]?.wrong ? (
                    <FaTimesCircle size={18} />
                  ) : (
                    <FaRegTimesCircle size={18} />
                  )}
                </button>
                <span className="text-xs font-bold text-red-700">غلط</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
