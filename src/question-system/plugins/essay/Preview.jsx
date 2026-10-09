"use client";

export default function EssayPreview({ question }) {
  return (
    <div className="text-sm text-gray-600 space-y-1">
      <p className="font-medium text-gray-800">{question.questionText || "—"}</p>
      <span className="text-xs text-purple-600">سؤال مقالي</span>
    </div>
  );
}
