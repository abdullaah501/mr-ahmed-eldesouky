"use client";

export default function MatchingPreview({ question }) {
  const pairs = question.config?.pairs || [];

  return (
    <div className="text-sm text-gray-600 space-y-2">
      <p className="font-medium text-gray-800">{question.questionText || "—"}</p>
      <div className="space-y-1">
        {pairs.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-xs">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {p.leftItem}
            </span>
            <span className="text-gray-300">←</span>
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
              {p.rightItem}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
