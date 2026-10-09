"use client";

import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import QuestionWorkspace from "../../Exams/ExamGenerator/QuestionWorkspace/QuestionWorkspace";
import "@/question-system/plugins/multiple-choice/index";
import "@/question-system/plugins/true-false/index";
import "@/question-system/plugins/essay/index";
import "@/question-system/plugins/fill-blank/index";
import "@/question-system/plugins/matching/index";

export default function ReviewStep({
  questions = [],
  regeneratingIndex,
  onChange,
  onDelete,
  onDuplicate,
  onRegenerate,
  onReorder,
  onValidate,
  validating,
}) {
  const [selected, setSelected] = useState(new Set());
  const draftIdsRef = useRef(new WeakMap());
  const reservedIds = new Set(
    questions.map((question) => question.id).filter(Boolean),
  );
  const usedIds = new Set();
  const reviewQuestions = questions.map((question, index) => {
    if (question.id && !usedIds.has(question.id)) {
      usedIds.add(question.id);
      return question;
    }
    const cached = draftIdsRef.current.get(question);
    if (cached && !usedIds.has(cached.id)) {
      usedIds.add(cached.id);
      return cached;
    }
    let id = `draft-${index}`;
    let suffix = 1;
    while (reservedIds.has(id) || usedIds.has(id))
      id = `draft-${index}-${suffix++}`;
    const withLocalId = { ...question, id };
    draftIdsRef.current.set(question, withLocalId);
    usedIds.add(id);
    return withLocalId;
  });
  const scrollRef = useRef(null);
  // Same virtualization approach as the Question Bank list (QuestionList):
  // dynamic row measurement + overscan; all questions stay in state, only the
  // visible window is mounted in the DOM.
  const virtualizer = useVirtualizer({
    count: reviewQuestions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 280,
    overscan: 6,
  });
  const toggle = (index, checked) =>
    setSelected((current) => {
      const next = new Set(current);
      checked ? next.add(index) : next.delete(index);
      return next;
    });
  return (
    <div className="space-y-4" dir="ltr">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">
          Reviewing {questions.length} questions
        </h3>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() =>
              [...selected].sort((a, b) => b - a).forEach(onDelete)
            }
            className="text-xs text-red-600"
          >
            Delete selected ({selected.size})
          </button>
        )}
      </div>
      <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto pr-1">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const question = reviewQuestions[virtualItem.index];
            const index = virtualItem.index;
            return (
              <article
                key={question.id || `${index}-${question.questionText}`}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                dir="ltr"
              >
            <div className="mb-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={(event) => toggle(index, event.target.checked)}
                />
                Question {index + 1}
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onRegenerate(index)}
                  disabled={regeneratingIndex === index}
                  className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700 disabled:opacity-50"
                >
                  {regeneratingIndex === index
                    ? "Regenerating..."
                    : "🔄 Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(index)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => index > 0 && onReorder?.(index, index - 1)}
                  disabled={index === 0}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() =>
                    index < questions.length - 1 &&
                    onReorder?.(index, index + 1)
                  }
                  disabled={index === questions.length - 1}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(index)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
            <QuestionWorkspace
              question={question}
              capabilities={{ canUpload: false, canChangeType: false }}
              showRepositoryFields
              isNew={false}
              onSave={(_, value) => onChange(index, value)}
              onChange={(value) => onChange(index, value)}
            />
          </article>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        disabled={validating || !questions.length}
        onClick={onValidate}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {validating ? "Validating..." : "Validate"}
      </button>
    </div>
  );
}
