"use client";

import { ReactSortable } from "react-sortablejs";
import { RxDragHandleDots2 } from "react-icons/rx";
import { FiPlus } from "react-icons/fi";
import { get, meta as getMeta } from "@/question-system/plugins/registry";

function QuestionRow({ q, index, isSelected, capabilities, onSelect, onDelete, onDuplicate }) {
  const typeMeta = getMeta(q.type);
  const badgeColor =
    q.type === "essay"
      ? "bg-purple-100 text-purple-800"
      : q.type === "true-false"
        ? "bg-blue-100 text-blue-800"
        : "bg-green-100 text-green-800";

  return (
    <div
      onClick={() => onSelect(q.id)}
      className={`group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <RxDragHandleDots2
        size={18}
        className="cursor-grab handle text-gray-400 hover:text-gray-600 flex-shrink-0"
      />

      <span className="bg-gray-200 text-gray-600 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>

      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${badgeColor}`}>
        {typeMeta.label || q.type}
      </span>

      <span className="text-sm text-gray-700 truncate flex-1 min-w-0">
        {q.questionText?.slice(0, 60) || "—"}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {capabilities.canDuplicate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(q.id);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
            title="تكرار"
          >
            <FiPlus size={14} />
          </button>
        )}
        {capabilities.canDeleteQuestion && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(q.id);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
            title="حذف"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function QuestionCollection({
  questions,
  selectedId,
  capabilities,
  onSelect,
  onDelete,
  onDuplicate,
  onReorder,
}) {
  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="mx-auto w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>لا توجد أسئلة في هذا الاختبار</p>
      </div>
    );
  }

  const sortableList = questions.map((q) => ({ ...q, id: q.id }));

  return (
    <ReactSortable
      handle=".handle"
      list={sortableList}
      setList={(list) => {
        if (capabilities.canReorder) {
          onReorder(list.map((item) => item.id));
        }
      }}
      animation={200}
      className="space-y-2"
      disabled={!capabilities.canReorder}
    >
      {questions.map((q, i) => (
        <QuestionRow
          key={q.id}
          q={q}
          index={i}
          isSelected={q.id === selectedId}
          capabilities={capabilities}
          onSelect={onSelect}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </ReactSortable>
  );
}
