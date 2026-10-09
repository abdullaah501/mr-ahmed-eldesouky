// lib/repository/exportSelection.js
//
// CLIENT-SAFE selection state for Question Bank export. This module is pure
// and must stay free of Mongoose/server imports — the server-side resolver
// lives in ./exportSelectionService.js.

export const MAX_EXPORT_QUESTIONS = 1000;
export const SELECTION_MODE_EXPLICIT = "explicit";
export const SELECTION_MODE_ALL_FILTERED = "allFiltered";

// Only filters actually exposed by the target Question Bank UI.
export const EXPORT_FILTER_KEYS = [
  "search",
  "type",
  "difficulty",
  "source",
  "grade",
  "subject",
];

export const initialExportSelection = {
  mode: SELECTION_MODE_EXPLICIT,
  selectedIds: [],
  excludedIds: [],
};

/**
 * Selection state machine. Invariants:
 *  - explicit mode: memory scales with explicit selections;
 *  - allFiltered mode: filters are the selection, memory scales with
 *    exclusions only — all matching Question ids are never materialized.
 */
export function exportSelectionReducer(state, action) {
  switch (action.type) {
    case "toggleExplicit": {
      if (state.mode !== SELECTION_MODE_EXPLICIT) return state;
      if (action.checked) {
        if (state.selectedIds.includes(action.id)) return state;
        return { ...state, selectedIds: [...state.selectedIds, action.id] };
      }
      return {
        ...state,
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
      };
    }
    case "toggleExclusion": {
      if (state.mode !== SELECTION_MODE_ALL_FILTERED) return state;
      if (action.checked) {
        return {
          ...state,
          excludedIds: state.excludedIds.filter((id) => id !== action.id),
        };
      }
      if (state.excludedIds.includes(action.id)) return state;
      return { ...state, excludedIds: [...state.excludedIds, action.id] };
    }
    case "selectAllFiltered":
      return {
        mode: SELECTION_MODE_ALL_FILTERED,
        selectedIds: [],
        excludedIds: [],
      };
    case "clearSelection":
      return initialExportSelection;
    case "filtersChanged":
      // All-filtered intent is bound to the filters that created it; a filter
      // change resets it so old exclusions cannot leak into a new set.
      return state.mode === SELECTION_MODE_ALL_FILTERED
        ? initialExportSelection
        : state;
    default:
      return state;
  }
}

export function isRowSelected(state, questionId) {
  return state.mode === SELECTION_MODE_ALL_FILTERED
    ? !state.excludedIds.includes(questionId)
    : state.selectedIds.includes(questionId);
}

/** Compact request — ids or filters+exclusions only, never Question data. */
export function buildExportRequest(state, { filters, includeAnswers } = {}) {
  const request = {
    mode: state.mode,
    includeAnswers: includeAnswers === true,
  };

  if (state.mode === SELECTION_MODE_ALL_FILTERED) {
    const snapshot = {};
    for (const key of EXPORT_FILTER_KEYS) {
      const value = filters?.[key];
      if (typeof value === "string" && value.trim()) {
        snapshot[key] = value.trim();
      } else if (Array.isArray(value) && value.length > 0) {
        snapshot[key] = value.slice();
      }
    }
    request.filters = snapshot;
    request.excludedIds = state.excludedIds.slice();
  } else {
    request.selectedIds = state.selectedIds.slice();
  }

  return request;
}
