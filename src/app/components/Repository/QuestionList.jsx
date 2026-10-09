"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { get } from "@/question-system/plugins/registry";
import { isRowSelected } from "../../../../lib/repository/exportSelection";
import "@/question-system/plugins/multiple-choice/index";
import "@/question-system/plugins/true-false/index";
import "@/question-system/plugins/essay/index";
import "@/question-system/plugins/fill-blank/index";
import "@/question-system/plugins/matching/index";
import "@/question-system/plugins/image-choice/index";
import MathRenderer from "@/app/components/math/MathRenderer";
import { LuX } from "react-icons/lu";

const TYPE_COLORS = {
  "multiple-choice": "bg-blue-100 text-blue-700",
  "true-false": "bg-green-100 text-green-700",
  essay: "bg-purple-100 text-purple-700",
  "fill-blank": "bg-amber-100 text-amber-700",
  matching: "bg-rose-100 text-rose-700",
  "image-choice": "bg-cyan-100 text-cyan-700",
};

const DIFFICULTY_COLORS = {
  easy: "bg-green-50 text-green-600",
  medium: "bg-yellow-50 text-yellow-600",
  hard: "bg-red-50 text-red-600",
};

function QuestionPreview({ question }) {
  const plugin = get(question.type);
  if (!plugin?.Preview) return null;
  const P = plugin.Preview;
  return <P question={question} />;
}

function RowCheckbox({ checked, onChange, id }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(id, e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400 flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function QuestionRow({ question, index, onSelect, selected, onPreview, onToggleSelect, showActions }) {
  const typeMeta = get(question.type)?.meta || {};
  const typeColor = TYPE_COLORS[question.type] || "bg-gray-100 text-gray-700";
  const diffColor = DIFFICULTY_COLORS[question.difficulty] || "bg-gray-50 text-gray-500";

  return (
    <div
      onClick={() => onPreview(question)}
      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 border-b border-gray-100 hover:bg-gray-50 ${
        selected ? "bg-blue-50/50 border-l-4 border-l-blue-500" : ""
      }`}
    >
      <RowCheckbox checked={selected} onChange={onToggleSelect} id={question._id} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeColor}`}>
            {typeMeta.label || question.type}
          </span>
          {question.difficulty && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${diffColor}`}>
              {question.difficulty}
            </span>
          )}
          {question.grade && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {question.grade}
            </span>
          )}
          {question.subject && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {question.subject}
            </span>
          )}
        </div>

        <div className="text-sm font-medium text-gray-800 line-clamp-2 leading-relaxed">
          <MathRenderer text={question.questionText || "—"} />
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span>Version {question.version || 1}</span>
          <span>•</span>
          <span>Used {question.usageCount || 0} times</span>
          {question.source !== "manual" && (
            <>
              <span>•</span>
              <span className="text-indigo-500">{question.source === "ai" ? "AI" : question.source}</span>
            </>
          )}
          {question.tags?.length > 0 && (
            <>
              <span>•</span>
              <span>{question.tags.map((t) => `#${t}`).join(" ")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuestionList({
  data,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selection,
  onToggleSelect,
  onPreview,
}) {
  const parentRef = useRef(null);
  const [previewQuestion, setPreviewQuestion] = useState(null);

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.items || []);
  }, [data]);

  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 8,
  });

  const handlePreview = useCallback(
    (q) => {
      setPreviewQuestion(q);
      onPreview?.(q);
    },
    [onPreview]
  );

  return (
    <div className="flex flex-col h-full">
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ contain: "strict" }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-500 text-sm">
            An error occurred while loading questions
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No matching questions</p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const question = allItems[virtualItem.index];
              return (
                <div
                  key={question._id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <QuestionRow
                    question={question}
                    index={virtualItem.index}
                    onSelect={handlePreview}
                    selected={isRowSelected(selection, question._id)}
                    onToggleSelect={onToggleSelect}
                    onPreview={handlePreview}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasNextPage && (
        <div className="p-2 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {previewQuestion && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 max-h-[40vh] overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Preview</h4>
            <button
              type="button"
              onClick={() => setPreviewQuestion(null)}
              className="text-gray-400 hover:text-gray-600 text-sm inline-flex items-center gap-1"
            >
              <LuX size={12} /> إغلاق
            </button>
          </div>
          <QuestionPreview question={previewQuestion} />
        </div>
      )}
    </div>
  );
}