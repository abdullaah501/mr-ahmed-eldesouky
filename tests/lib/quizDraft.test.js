import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QUIZ_DRAFT_LOCAL_DEBOUNCE_MS,
  QUIZ_DRAFT_SYNC_DEBOUNCE_MS,
  QUIZ_DRAFT_VERSION,
  buildInitialDraftState,
  clearLocalDraft,
  quizDraftKey,
  readLocalDraft,
  reconcileAnswers,
  sanitizeDraftAnswers,
  writeLocalDraft,
} from "../../lib/quizDraft";

const STUDENT = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_STUDENT = "bbbbbbbbbbbbbbbbbbbbbbbb";
const EXAM = "111111111111111111111111";
const OTHER_EXAM = "222222222222222222222222";
const Q1 = "cccccccccccccccccccccccc";
const Q2 = "dddddddddddddddddddddddd";

function createStorage() {
  const map = new Map();
  return {
    map,
    getItem: vi.fn((key) => (map.has(key) ? map.get(key) : null)),
    setItem: vi.fn((key, value) => map.set(key, String(value))),
    removeItem: vi.fn((key) => map.delete(key)),
  };
}

let storage;

beforeEach(() => {
  storage = createStorage();
  globalThis.window = { localStorage: storage };
});

afterEach(() => {
  delete globalThis.window;
});

describe("quizDraft local payload", () => {
  it("uses the studentId + examId key", () => {
    expect(quizDraftKey(STUDENT, EXAM)).toBe(`quizDraft_${STUDENT}_${EXAM}`);
  });

  it("round-trips the v2 payload", () => {
    writeLocalDraft(STUDENT, EXAM, {
      serverRevision: 3,
      baseAnswers: { [Q1]: "a" },
      answers: { [Q1]: "b", [Q2]: "" },
    });

    const read = readLocalDraft(STUDENT, EXAM);
    expect(read.v).toBe(QUIZ_DRAFT_VERSION);
    expect(read.serverRevision).toBe(3);
    expect(read.baseAnswers).toEqual({ [Q1]: "a" });
    expect(read.answers).toEqual({ [Q1]: "b", [Q2]: "" });
    expect(typeof read.updatedAt).toBe("number");
  });

  it("migrates a v1 {answers} payload without discarding answers", () => {
    storage.setItem(
      quizDraftKey(STUDENT, EXAM),
      JSON.stringify({ answers: { [Q1]: "x" } })
    );

    const read = readLocalDraft(STUDENT, EXAM);
    expect(read.v).toBe(QUIZ_DRAFT_VERSION);
    expect(read.answers).toEqual({ [Q1]: "x" });
    expect(read.baseAnswers).toEqual({});
    expect(read.serverRevision).toBe(0);
  });

  it("migrates a bare answer map", () => {
    storage.setItem(
      quizDraftKey(STUDENT, EXAM),
      JSON.stringify({ [Q1]: "legacy", [Q2]: 5 })
    );

    const read = readLocalDraft(STUDENT, EXAM);
    expect(read.answers).toEqual({ [Q1]: "legacy" });
    expect(read.serverRevision).toBe(0);
  });

  it("resolves malformed local data to no draft", () => {
    storage.setItem(quizDraftKey(STUDENT, EXAM), "{not-json");
    expect(readLocalDraft(STUDENT, EXAM)).toBeNull();
  });

  it("does not leak drafts across accounts or exams", () => {
    writeLocalDraft(STUDENT, EXAM, {
      serverRevision: 1,
      baseAnswers: {},
      answers: { [Q1]: "mine" },
    });

    expect(readLocalDraft(OTHER_STUDENT, EXAM)).toBeNull();
    expect(readLocalDraft(STUDENT, OTHER_EXAM)).toBeNull();
  });

  it("clears only the addressed draft", () => {
    writeLocalDraft(STUDENT, EXAM, {
      serverRevision: 1,
      baseAnswers: {},
      answers: { [Q1]: "mine" },
    });
    clearLocalDraft(STUDENT, EXAM);
    expect(readLocalDraft(STUDENT, EXAM)).toBeNull();
  });

  it("is SSR-safe and storage-failure-safe", () => {
    delete globalThis.window;
    expect(readLocalDraft(STUDENT, EXAM)).toBeNull();
    expect(writeLocalDraft(STUDENT, EXAM, { answers: {} })).toBe(false);
    expect(clearLocalDraft(STUDENT, EXAM)).toBe(false);

    globalThis.window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(readLocalDraft(STUDENT, EXAM)).toBeNull();
    expect(writeLocalDraft(STUDENT, EXAM, { answers: {} })).toBe(false);
    expect(clearLocalDraft(STUDENT, EXAM)).toBe(false);
  });

  it("uses the source reference timing constants", () => {
    expect(QUIZ_DRAFT_LOCAL_DEBOUNCE_MS).toBe(500);
    expect(QUIZ_DRAFT_SYNC_DEBOUNCE_MS).toBe(5000);
  });

  it("prunes answers to the exam's current question ids", () => {
    expect(
      sanitizeDraftAnswers({ [Q1]: "a", stale: "x", [Q2]: 7 }, [Q1, Q2])
    ).toEqual({ [Q1]: "a" });
  });
});

describe("per-question reconciliation", () => {
  it("server wins when local is unchanged (local == base)", () => {
    const merged = reconcileAnswers({
      base: { [Q1]: "a" },
      local: { [Q1]: "a" },
      server: { [Q1]: "server" },
    });
    expect(merged[Q1]).toBe("server");
  });

  it("local wins when the server is unchanged (server == base)", () => {
    const merged = reconcileAnswers({
      base: { [Q1]: "a" },
      local: { [Q1]: "local" },
      server: { [Q1]: "a" },
    });
    expect(merged[Q1]).toBe("local");
  });

  it("same-question conflict deterministically prefers the server", () => {
    const merged = reconcileAnswers({
      base: { [Q1]: "a" },
      local: { [Q1]: "local" },
      server: { [Q1]: "server" },
    });
    expect(merged[Q1]).toBe("server");
  });

  it("non-conflicting device changes survive together", () => {
    const merged = reconcileAnswers({
      base: { [Q1]: "a", [Q2]: "b" },
      local: { [Q1]: "a-local", [Q2]: "b" },
      server: { [Q1]: "a", [Q2]: "b-server" },
    });
    expect(merged).toEqual({ [Q1]: "a-local", [Q2]: "b-server" });
  });

  it("local clearing is preserved when the server did not change", () => {
    const merged = reconcileAnswers({
      base: { [Q1]: "a" },
      local: { [Q1]: "" },
      server: { [Q1]: "a" },
    });
    expect(merged[Q1]).toBe("");
  });
});

describe("buildInitialDraftState", () => {
  it("hydrates the server draft when no local draft exists", () => {
    const state = buildInitialDraftState({
      serverDraft: { answers: { [Q1]: "s" }, revision: 4 },
      localDraft: null,
      questionIds: [Q1, Q2],
    });
    expect(state.answers).toEqual({ [Q1]: "s" });
    expect(state.baseAnswers).toEqual({ [Q1]: "s" });
    expect(state.serverRevision).toBe(4);
    expect(state.dirty).toBe(false);
  });

  it("keeps unsynced local answers and marks them dirty", () => {
    const state = buildInitialDraftState({
      serverDraft: { answers: {}, revision: 0 },
      localDraft: {
        v: 2,
        serverRevision: 0,
        baseAnswers: {},
        answers: { [Q1]: "offline" },
      },
      questionIds: [Q1],
    });
    expect(state.answers).toEqual({ [Q1]: "offline" });
    expect(state.baseAnswers).toEqual({});
    expect(state.serverRevision).toBe(0);
    expect(state.dirty).toBe(true);
  });

  it("reconciles a local draft against newer canonical state", () => {
    const state = buildInitialDraftState({
      serverDraft: { answers: { [Q1]: "a", [Q2]: "server" }, revision: 7 },
      localDraft: {
        v: 2,
        serverRevision: 5,
        baseAnswers: { [Q1]: "a", [Q2]: "b" },
        answers: { [Q1]: "local", [Q2]: "b" },
      },
      questionIds: [Q1, Q2],
    });
    // Q1: server == base → local wins. Q2: local == base → server wins.
    expect(state.answers).toEqual({ [Q1]: "local", [Q2]: "server" });
    expect(state.baseAnswers).toEqual({ [Q1]: "a", [Q2]: "server" });
    expect(state.serverRevision).toBe(7);
    expect(state.dirty).toBe(true);
  });

  it("prunes stale question ids from both sources", () => {
    const state = buildInitialDraftState({
      serverDraft: { answers: { stale: "x", [Q1]: "s" }, revision: 2 },
      localDraft: {
        v: 2,
        serverRevision: 2,
        baseAnswers: { [Q1]: "s" },
        answers: { [Q1]: "s", stale: "y" },
      },
      questionIds: [Q1],
    });
    expect(state.answers).toEqual({ [Q1]: "s" });
    expect(state.dirty).toBe(false);
  });
});
