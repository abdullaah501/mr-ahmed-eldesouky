"use client";

export default function TrueFalsePreview({ question }) {
  return (
    <div className="text-sm text-gray-600 space-y-1">
      <p className="font-medium text-gray-800">{question.questionText || "—"}</p>
      <span className="text-xs text-blue-600">
        {question.correctAnswer === "true" ? "الإجابة: صح" : "الإجابة: خطأ"}
      </span>
    </div>
  );
}
