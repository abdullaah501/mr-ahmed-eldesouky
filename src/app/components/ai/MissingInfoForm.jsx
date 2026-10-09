"use client";

import { useEffect, useMemo, useState } from "react";

export function formatMissingInfoMessage(fields = []) {
  const labels = fields
    .map((field) => field.label || field.key)
    .filter(Boolean);
  return [
    "Questions can't be generated yet.",
    "The system needs some information before starting:",
    ...labels.map((label) => `• ${label}`),
    "Select or enter the required information, then continue.",
  ].join("\n");
}

export default function MissingInfoForm({
  fields = [],
  onSubmit,
  submitting = false,
  initialAnswers = {},
}) {
  const ordered = useMemo(
    () => [...fields].sort((a, b) => a.priority - b.priority),
    [fields],
  );
  const [values, setValues] = useState(initialAnswers || {});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setValues(initialAnswers || {});
    setErrors({});
  }, [initialAnswers]);

  function update(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key])
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
  }

  function validate() {
    const next = {};
    for (const field of ordered) {
      if (field.required) {
        const value = values[field.key];
        if (field.key === "questionTypes") {
          if (!Array.isArray(value) || value.length === 0)
            next[field.key] = `${field.label} is required`;
        } else if (field.key === "questionCount") {
          if (!value || Number(value) < 1)
            next[field.key] = "Number of questions is required";
        } else if (!value || (typeof value === "string" && !value.trim())) {
          next[field.key] = `${field.label} is required`;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    onSubmit?.(values);
  }

  return (
    <form onSubmit={submit} className="space-y-4" dir="ltr">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <p className="whitespace-pre-line">
          {formatMissingInfoMessage(ordered)}
        </p>
      </div>
      {ordered.map((field) => (
        <label key={field.key} className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-semibold text-gray-700">
            <span>
              {field.label || field.key}
              {field.required && (
                <span className="mr-0.5 text-red-500" title="Required">
                  *
                </span>
              )}
            </span>
            <span className="text-[11px] font-normal text-gray-400">
              {field.reason === "low-confidence" ? "Low confidence" : ""}
            </span>
          </span>
          {field.current && (
            <span className="block text-xs text-gray-500">
              Current value: {formatCurrent(field.current)}
            </span>
          )}
          {Array.isArray(field.options) && field.key === "questionTypes" ? (
            <div className="flex flex-wrap gap-2">
              {field.options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={(values[field.key] || []).includes(option)}
                    onChange={(event) =>
                      update(
                        field.key,
                        event.target.checked
                          ? [...(values[field.key] || []), option]
                          : (values[field.key] || []).filter(
                              (item) => item !== option,
                            ),
                      )
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : Array.isArray(field.options) ? (
            <select
              value={values[field.key] || ""}
              onChange={(event) => update(field.key, event.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors[field.key] ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            >
              <option value="">Select...</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.key === "questionCount" ? "number" : "text"}
              min={field.key === "questionCount" ? 1 : undefined}
              value={values[field.key] || ""}
              onChange={(event) =>
                update(
                  field.key,
                  field.key === "questionCount"
                    ? Number(event.target.value)
                    : event.target.value,
                )
              }
              placeholder={field.required ? `${field.label} is required` : ""}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors[field.key] ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
          )}
          {errors[field.key] && (
            <span className="block text-xs text-red-600">
              {errors[field.key]}
            </span>
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Confirm Information"}
      </button>
    </form>
  );
}

function formatCurrent(value) {
  if (value && typeof value === "object" && "value" in value)
    return String(value.value);
  return Array.isArray(value) ? value.join(", ") : String(value);
}
