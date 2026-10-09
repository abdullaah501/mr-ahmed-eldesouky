"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiSearch } from "react-icons/fi";
import { api } from "../../../../../lib/axios/axios";
import debounce from "../../../../../lib/debounce";
import UsersExamsResults from "@/app/components/analytics/UsersExamsResults";

export default function ResultsClient({ role }) {
  const [gradeId, setGradeId] = useState("");
  const [examId, setExamId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const updateDebouncedSearch = useMemo(
    () => debounce((v) => setDebouncedSearch(v), 700),
    [],
  );

  // Grade options — reuse the existing grade-loading pattern
  // (admin → /api/grades, assistant → getMyGradesForAssistant).
  const gradesQuery = useQuery({
    queryKey: role === "assistant" ? ["assistantGrades"] : ["activeGrades"],
    queryFn: async () => {
      if (role === "assistant") {
        const { getMyGradesForAssistant } = await import(
          "@/app/actions/staffActions"
        );
        const res = await getMyGradesForAssistant();
        if (!res?.success)
          throw new Error(res?.message || "Failed to fetch grades");
        return res.data;
      }
      const res = await api.get("/api/grades");
      if (!res?.data?.success)
        throw new Error(res?.data?.message || "Failed to fetch grades");
      return res.data.data;
    },
    refetchOnWindowFocus: false,
  });

  // Query A — exam filter options. Fetched once + cached (stable key), then
  // narrowed locally by the selected grade so changing Grade never refetches.
  const examOptionsQuery = useQuery({
    queryKey: ["examFilterOptions"],
    queryFn: async () => {
      const res = await api.get("/api/usersExamsResults?options=1");
      const d = res.data;
      if (!d?.success) throw new Error("Failed to load exam options");
      return d.filterOptions?.exams || [];
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const exams = examOptionsQuery.data || [];
  const visibleExams = gradeId
    ? exams.filter((e) => e.gradeId === gradeId)
    : exams;

  const filters = useMemo(
    () => ({ gradeId, examId, search: debouncedSearch }),
    [gradeId, examId, debouncedSearch],
  );

  const handleGradeChange = (value) => {
    setGradeId(value);
    setExamId(""); // clear exam unconditionally — never an invalid grade+exam pair
  };

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="mb-1.5 text-xs font-extrabold tracking-wider text-brand-navy">
              الصف
            </p>
            <select
              value={gradeId}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
            >
              <option value="">كل الصفوف</option>
              {(gradesQuery.data || []).map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-extrabold tracking-wider text-brand-navy">
              الاختبار
            </p>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
            >
              <option value="">كل الاختبارات</option>
              {visibleExams.map((e) => (
                <option key={e.examId} value={e.examId}>
                  {e.title || "اختبار بدون عنوان"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-extrabold tracking-wider text-brand-navy">
              البحث
            </p>
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                size={16}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  updateDebouncedSearch(e.target.value);
                }}
                placeholder="دوّر بالاسم أو البريد الإلكتروني..."
                className="w-full rounded-xl border border-border bg-card py-2.5 pr-10 pl-4 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <UsersExamsResults filters={filters} />
    </div>
  );
}
