"use client";

import { useState } from "react";
import { DIFFICULTY_LEVELS } from "../../../../../constants/questionDifficulty";
import { BLOOM_LEVELS } from "../../../../../constants/bloomLevels";

const TYPES = [
  "multiple-choice",
  "true-false",
  "essay",
  "fill-blank",
  "matching",
];

export default function GenerationSettingsStep({
  initial = {},
  onSubmit,
  loading,
}) {
  const [params, setParams] = useState({
    questionCount: 5,
    difficulty: "medium",
    questionTypes: ["multiple-choice"],
    bloomLevel: "",
    language: "auto",
    outputPreferences: "",
    ...initial,
  });
  const update = (key, value) =>
    setParams((current) => ({ ...current, [key]: value }));
  const toggleType = (type) =>
    update(
      "questionTypes",
      params.questionTypes.includes(type)
        ? params.questionTypes.filter((item) => item !== type)
        : [...params.questionTypes, type],
    );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(params);
      }}
      className="space-y-4"
      dir="ltr"
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-gray-700">
          Number of Questions
        </span>
        <input
          type="number"
          min="1"
          max="100"
          value={params.questionCount}
          onChange={(event) =>
            update("questionCount", Number(event.target.value))
          }
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Difficulty Level
        </span>
        <div className="flex gap-2">
          {DIFFICULTY_LEVELS.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() => update("difficulty", item.value)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                params.difficulty === item.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Question Types
        </span>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((item) => (
            <label
              key={item}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={params.questionTypes.includes(item)}
                onChange={() => toggleType(item)}
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-gray-700">
            Bloom Level
          </span>
          <select
            value={params.bloomLevel || ""}
            onChange={(event) => update("bloomLevel", event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Optional</option>
            {BLOOM_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-gray-700">Language</span>
          <input
            value={params.language}
            onChange={(event) => update("language", event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-gray-700">
          Output Preferences
        </span>
        <textarea
          value={params.outputPreferences}
          onChange={(event) => update("outputPreferences", event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-200 p-3 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={loading || !params.questionTypes.length}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Questions"}
      </button>
    </form>
  );
}
