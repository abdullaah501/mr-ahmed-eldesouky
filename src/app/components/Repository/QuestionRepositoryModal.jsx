"use client";

import { useState, useMemo, useCallback } from "react";
import Modal from "@/app/components/modal/Modal";
import { useRepositorySearch } from "@/hooks/useRepositorySearch";
import QuestionList from "./QuestionList";
import QuestionFilters from "./QuestionFilters";
import { getRepositoryQuestionsByIds } from "@/app/actions/repositoryActions";
import debounce from "../../../../lib/debounce";

const EMPTY_FILTERS = {
  search: "",
  type: [],
  difficulty: [],
  source: [],
  grade: [],
  subject: [],
};

const debouncedSetSearch = debounce((fn) => fn(), 350);

export default function QuestionRepositoryModal({
  isOpen,
  onClose,
  onSelect,
  existingQuestionIds = [],
}) {
  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    subject: ["الكيمياء"],
    type: ["multiple-choice", "image-choice"],
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const activeFilters = useMemo(
    () => ({
      search: filters.search || undefined,
      type: filters.type?.length ? filters.type : undefined,
      difficulty: filters.difficulty?.length ? filters.difficulty : undefined,
      source: filters.source?.length ? filters.source : undefined,
      grade: filters.grade?.length ? filters.grade : undefined,
      subject: filters.subject?.length ? filters.subject : undefined,
      limit: 30,
    }),
    [filters],
  );

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useRepositorySearch(activeFilters, { enabled: isOpen });

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value);
    debouncedSetSearch(() => {
      setFilters((prev) => ({ ...prev, search: value }));
    });
  }, []);

  const toggleSelect = useCallback(
    (id, checked) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          if (!existingQuestionIds.includes(id)) next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [existingQuestionIds],
  );

  const handleAdd = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      const res = await getRepositoryQuestionsByIds([...selectedIds]);
      if (res.success && res.questions) {
        onSelect(res.questions);
      }
      setSelectedIds(new Set());
      onClose();
    } catch (error) {
      console.error("Failed to add questions:", error);
    } finally {
      setAdding(false);
    }
  }, [selectedIds, onSelect, onClose]);

  const selectedCount = selectedIds.size;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Question Bank">
      <div className="flex flex-col h-[70vh] max-h-[600px]">
        {/* Search bar */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Search for a question..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Clear selection ({selectedCount})
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 flex gap-3">
          {/* Filters */}
          <div className="w-56 flex-shrink-0 overflow-auto hidden md:block">
            <QuestionFilters filters={filters} onChange={setFilters} />
          </div>

          {/* List */}
          <div className="flex-1 min-w-0 border border-gray-100 rounded-xl overflow-hidden bg-white">
            <QuestionList
              data={data}
              isLoading={isLoading}
              isError={isError}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          </div>
        </div>

        {/* Footer: actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
          <div className="text-sm text-gray-500">
            {selectedCount > 0
              ? `${selectedCount} questions selected`
              : "Select questions to add to the exam"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={selectedCount === 0 || adding}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding
                ? "Adding..."
                : `Add ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
