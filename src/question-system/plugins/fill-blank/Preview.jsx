"use client";

import { readCandidates } from "./core";

export default function FillBlankPreview({ question }) {
  const display = (question.questionText || "").replace(
    /____/g,
    "________"
  );
  const answers = readCandidates(question);
  const filled = answers.filter((a) => a.text?.trim());

  return (
    <div className="text-sm text-gray-600 space-y-1">
      <p className="font-medium text-gray-800">{display}</p>
      {filled.length > 1 ? (
        <div className="text-xs text-blue-600">
          <span>الإجابات: </span>
          {filled.map((a, i) => (
            <span key={a.id || i}>
              {i > 0 && " / "}
              <span className={a.isCorrect ? "font-semibold text-green-600" : ""}>{a.text.trim()}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-blue-600">
          الإجابة: {question.correctAnswer || filled[0]?.text}
        </span>
      )}
    </div>
  );
}
