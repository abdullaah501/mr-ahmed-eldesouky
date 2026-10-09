import { describe, it, expect } from "vitest";
import {
  MAX_EXPORT_QUESTIONS,
  SELECTION_MODE_ALL_FILTERED,
  SELECTION_MODE_EXPLICIT,
  buildExportRequest,
  exportSelectionReducer,
  initialExportSelection,
  isRowSelected,
} from "../../lib/repository/exportSelection";

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("exportSelectionReducer", () => {
  it("keeps explicit selection behavior unchanged", () => {
    let state = exportSelectionReducer(initialExportSelection, {
      type: "toggleExplicit",
      id: A,
      checked: true,
    });
    expect(state.mode).toBe(SELECTION_MODE_EXPLICIT);
    expect(state.selectedIds).toEqual([A]);

    state = exportSelectionReducer(state, {
      type: "toggleExplicit",
      id: B,
      checked: true,
    });
    expect(state.selectedIds).toEqual([A, B]);

    state = exportSelectionReducer(state, {
      type: "toggleExplicit",
      id: A,
      checked: false,
    });
    expect(state.selectedIds).toEqual([B]);
  });

  it("select-all-filtered stores filters intent only — no ids", () => {
    const state = exportSelectionReducer(initialExportSelection, {
      type: "selectAllFiltered",
    });
    expect(state.mode).toBe(SELECTION_MODE_ALL_FILTERED);
    expect(state.selectedIds).toEqual([]);
    expect(state.excludedIds).toEqual([]);
  });

  it("allFiltered memory scales with exclusions, not the dataset", () => {
    let state = exportSelectionReducer(initialExportSelection, {
      type: "selectAllFiltered",
    });

    // Deselecting a row adds exactly one exclusion and materializes no ids.
    state = exportSelectionReducer(state, {
      type: "toggleExclusion",
      id: A,
      checked: false,
    });
    expect(state.selectedIds).toEqual([]);
    expect(state.excludedIds).toEqual([A]);

    // Reselecting removes exactly one exclusion.
    state = exportSelectionReducer(state, {
      type: "toggleExclusion",
      id: A,
      checked: true,
    });
    expect(state.excludedIds).toEqual([]);
  });

  it("a filter change resets allFiltered selection", () => {
    const selected = exportSelectionReducer(initialExportSelection, {
      type: "selectAllFiltered",
    });
    const reset = exportSelectionReducer(selected, { type: "filtersChanged" });
    expect(reset).toEqual(initialExportSelection);
  });

  it("a filter change leaves explicit selection untouched", () => {
    const selected = exportSelectionReducer(initialExportSelection, {
      type: "toggleExplicit",
      id: A,
      checked: true,
    });
    const same = exportSelectionReducer(selected, { type: "filtersChanged" });
    expect(same).toBe(selected);
  });

  it("row selection is derived per mode", () => {
    const explicit = { mode: "explicit", selectedIds: [A], excludedIds: [] };
    expect(isRowSelected(explicit, A)).toBe(true);
    expect(isRowSelected(explicit, B)).toBe(false);

    const allFiltered = {
      mode: "allFiltered",
      selectedIds: [],
      excludedIds: [B],
    };
    expect(isRowSelected(allFiltered, A)).toBe(true);
    expect(isRowSelected(allFiltered, B)).toBe(false);
  });
});

describe("buildExportRequest", () => {
  it("builds a compact explicit request", () => {
    const request = buildExportRequest(
      { mode: "explicit", selectedIds: [A, B], excludedIds: [] },
      { filters: { search: "x" }, includeAnswers: false }
    );
    expect(request).toEqual({
      mode: "explicit",
      selectedIds: [A, B],
      includeAnswers: false,
    });
  });

  it("builds an allFiltered request with a filter snapshot and exclusions", () => {
    const request = buildExportRequest(
      { mode: "allFiltered", selectedIds: [], excludedIds: [B] },
      {
        filters: {
          search: "  algebra ",
          type: ["multiple-choice"],
          grade: ["الصف الأول"],
          status: ["active"],
          limit: 30,
        },
        includeAnswers: true,
      }
    );
    expect(request).toEqual({
      mode: "allFiltered",
      includeAnswers: true,
      filters: {
        search: "algebra",
        type: ["multiple-choice"],
        grade: ["الصف الأول"],
      },
      excludedIds: [B],
    });
    expect(request).not.toHaveProperty("selectedIds");
  });

  it("never sends Question documents", () => {
    const request = buildExportRequest(
      { mode: "explicit", selectedIds: [A], excludedIds: [] },
      { filters: {}, includeAnswers: false, questions: [{ _id: A }] }
    );
    expect(request).not.toHaveProperty("questions");
    expect(JSON.stringify(request)).not.toContain("questionText");
  });

  it("exposes the 1000-question bound", () => {
    expect(MAX_EXPORT_QUESTIONS).toBe(1000);
  });
});
