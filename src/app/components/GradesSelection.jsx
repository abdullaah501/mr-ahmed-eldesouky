"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/axios/axios";

export default function GradesSelection({
  value,
  onChange,
  error,
  role,
  onlyGrades,
  grade,
  fetchUrl = "/api/grades",
}) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchGrades() {
      try {
        const res = await api.get(fetchUrl);
        if (cancelled) return;
        if (res?.data?.success) {
          const payload = Array.isArray(res.data.grades)
            ? res.data.grades
            : res.data.data;
          if (Array.isArray(payload)) {
            setGrades(payload);
          }
        }
      } catch (err) {
        console.error("Failed to fetch grades:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchGrades();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  if (loading) {
    return (
      <div className="w-full text-right md:col-span-2">
        <select
          value={value}
          onChange={onChange}
          disabled
          className="block w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-[var(--text-primary)] outline-none"
        >
          <option value="">جاري تحميل الصفوف...</option>
        </select>
        {error && (
          <p className="text-red-500 text-xs mt-1">هذا الحقل مطلوب</p>
        )}
      </div>
    );
  }

  const filteredGrades =
    onlyGrades || role !== "admin"
      ? grades.filter((g) => g.name === grade)
      : grades;

  return (
    <div className="w-full text-right md:col-span-2">
      <select
        value={value}
        onChange={onChange}
        className={`w-full rounded-xl border bg-card px-4 py-3.5 text-sm font-medium text-[var(--text-primary)] outline-none transition-colors ${error ? "border-red-300 bg-red-50/50" : "border-border"}`}
      >
        <option value="">اختار الصف الدراسي</option>
        {grades
          .filter((g) => !onlyGrades || role === "admin" || g.name === grade)
          .map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
            </option>
          ))}
      </select>
    </div>
  );
}
