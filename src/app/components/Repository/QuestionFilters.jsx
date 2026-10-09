"use client";

import { memo } from "react";
import { LuX } from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import { SUBJECTS } from "../../../../constants/subjects";
import { DIFFICULTY_LEVELS } from "../../../../constants/questionDifficulty";
import { api } from "../../../../lib/axios/axios";

const QUESTION_TYPES = [
  { value: "multiple-choice", label: "اختيار من متعدد" },
  { value: "true-false", label: "صح / خطأ" },
  { value: "essay", label: "مقالي" },
  { value: "fill-blank", label: "أكمل" },
  { value: "matching", label: "توصيل" },
  { value: "image-choice", label: "اختيار بالصور" },
];

const SOURCES = [
  { value: "manual", label: "يدوي" },
  { value: "import", label: "مستورد" },
  { value: "ai", label: "ذكاء اصطناعي" },
];

function FilterSection({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function CheckboxGroup({ options, value, onChange }) {
  function toggle(v) {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-shadow ${
            value.includes(opt.value)
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const MemoizedFilters = memo(function QuestionFilters({ filters, onChange }) {
  const { data: grades } = useQuery({
    queryKey: ["activeGrades"],
    queryFn: async () => {
      const res = await fetch("/api/grades");
      if (!res.ok) throw new Error("Failed to fetch grades");
      const data = await res.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  function update(patch) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-gray-100">
      <FilterSection title="نوع السؤال">
        <CheckboxGroup
          options={QUESTION_TYPES}
          value={filters.type || []}
          onChange={(v) => update({ type: v })}
        />
      </FilterSection>

      <FilterSection title="الصعوبة">
        <CheckboxGroup
          options={DIFFICULTY_LEVELS}
          value={filters.difficulty || []}
          onChange={(v) => update({ difficulty: v })}
        />
      </FilterSection>

      <FilterSection title="مصدر السؤال">
        <CheckboxGroup
          options={SOURCES}
          value={filters.source || []}
          onChange={(v) => update({ source: v })}
        />
      </FilterSection>

      <FilterSection title="الصف">
        <CheckboxGroup
          options={grades?.map((g) => ({ value: g.name, label: g.name })) || []}
          value={filters.grade || []}
          onChange={(v) => update({ grade: v })}
        />
      </FilterSection>

      <FilterSection title="المادة">
        <CheckboxGroup
          options={SUBJECTS.map((s) => ({ value: s, label: s }))}
          value={filters.subject || []}
          onChange={(v) => update({ subject: v })}
        />
      </FilterSection>

      {(filters.type?.length || filters.difficulty?.length || filters.source?.length || filters.grade?.length || filters.subject?.length) ? (
        <button
          type="button"
          onClick={() => onChange({ ...filters, type: [], difficulty: [], source: [], grade: [], subject: [] })}
          className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1"
        >
          <LuX size={12} /> مسح كل الفلاتر
        </button>
      ) : null}
    </div>
  );
});

export default MemoizedFilters;