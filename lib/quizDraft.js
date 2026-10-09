// lib/quizDraft.js
//
// Client-safe hybrid draft helpers. MongoDB QuizDraft is the canonical server
// state; localStorage is only a fast local cache / offline buffer carrying the
// minimal answer map plus the reconciliation metadata.
//
// This module is imported by both the client (Quiz) and the server action
// (answer sanitization), so it must never import server-only or DB modules.

export const QUIZ_DRAFT_VERSION = 2;
export const QUIZ_DRAFT_LOCAL_DEBOUNCE_MS = 500;
export const QUIZ_DRAFT_SYNC_DEBOUNCE_MS = 5000;

const QUESTION_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function quizDraftKey(studentId, examId) {
  return `quizDraft_${studentId}_${examId}`;
}

function getStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Safari private mode / disabled storage.
    return null;
  }
}

function toAnswerMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, answer] of Object.entries(value)) {
    if (typeof answer === "string") out[key] = answer;
  }
  return out;
}

function answersEqual(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/**
 * Normalizes a stored local payload to the current version.
 * v1 (or older plain answer maps) keep their answers; reconciliation metadata
 * starts empty at serverRevision 0. Invalid data resolves to null.
 */
export function migrateLocalDraft(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  if (parsed.v === QUIZ_DRAFT_VERSION) {
    return {
      v: QUIZ_DRAFT_VERSION,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      serverRevision:
        Number.isInteger(parsed.serverRevision) && parsed.serverRevision >= 0
          ? parsed.serverRevision
          : 0,
      baseAnswers: toAnswerMap(parsed.baseAnswers),
      answers: toAnswerMap(parsed.answers),
    };
  }

  // v1 migration: `{ answers }` or a bare {questionId: string} map.
  return {
    v: QUIZ_DRAFT_VERSION,
    updatedAt: Date.now(),
    serverRevision: 0,
    baseAnswers: {},
    answers: toAnswerMap(parsed.answers ?? parsed),
  };
}

export function readLocalDraft(studentId, examId) {
  const storage = getStorage();
  if (!storage || !studentId || !examId) return null;
  try {
    const raw = storage.getItem(quizDraftKey(studentId, examId));
    if (!raw) return null;
    return migrateLocalDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalDraft(studentId, examId, draft) {
  const storage = getStorage();
  if (!storage || !studentId || !examId) return false;
  try {
    storage.setItem(
      quizDraftKey(studentId, examId),
      JSON.stringify({
        v: QUIZ_DRAFT_VERSION,
        updatedAt: Date.now(),
        serverRevision:
          Number.isInteger(draft?.serverRevision) && draft.serverRevision >= 0
            ? draft.serverRevision
            : 0,
        baseAnswers: toAnswerMap(draft?.baseAnswers),
        answers: toAnswerMap(draft?.answers),
      })
    );
    return true;
  } catch {
    // Quota / unavailable storage — local persistence is best effort.
    return false;
  }
}

export function clearLocalDraft(studentId, examId) {
  const storage = getStorage();
  if (!storage || !studentId || !examId) return false;
  try {
    storage.removeItem(quizDraftKey(studentId, examId));
    return true;
  } catch {
    return false;
  }
}

/** Keeps only string answers for the exam's current question ids. */
export function sanitizeDraftAnswers(values, questionIds) {
  const out = {};
  if (!values || typeof values !== "object") return out;
  for (const questionId of questionIds || []) {
    const value = values[questionId];
    if (typeof value === "string") out[questionId] = value;
  }
  return out;
}

/**
 * Three-way per-question reconciliation:
 *   local == server                  → same value
 *   server == base                   → local wins
 *   local == base (server changed)   → server wins
 *   all three differ                 → server wins
 * Non-conflicting changes from different devices survive.
 */
export function reconcileAnswers({ base, local, server } = {}) {
  const baseAnswers = base || {};
  const localAnswers = local || {};
  const serverAnswers = server || {};
  const ids = new Set([
    ...Object.keys(baseAnswers),
    ...Object.keys(localAnswers),
    ...Object.keys(serverAnswers),
  ]);

  const merged = {};
  for (const id of ids) {
    const b = baseAnswers[id];
    const l = localAnswers[id];
    const s = serverAnswers[id];

    let value;
    if (l === s) value = l;
    else if (s === b) value = l;
    else value = s;

    if (value !== undefined) merged[id] = value;
  }
  return merged;
}

/**
 * Builds the synchronous initial form state before any renderer mounts.
 * `serverDraft` = { answers, revision } from getExam (or null).
 * `localDraft`  = readLocalDraft(...) (or null).
 */
export function buildInitialDraftState({ serverDraft, localDraft, questionIds } = {}) {
  const hasQuestionFilter = Array.isArray(questionIds);
  const prune = (answers) =>
    hasQuestionFilter ? sanitizeDraftAnswers(answers, questionIds) : answers;

  const serverAnswers = prune(toAnswerMap(serverDraft?.answers));
  const serverRevision =
    Number.isInteger(serverDraft?.revision) && serverDraft.revision > 0
      ? serverDraft.revision
      : 0;

  if (!localDraft) {
    return {
      answers: serverAnswers,
      baseAnswers: serverAnswers,
      serverRevision,
      dirty: false,
    };
  }

  const merged = prune(
    reconcileAnswers({
      base: localDraft.baseAnswers,
      local: localDraft.answers,
      server: serverAnswers,
    })
  );

  const dirty =
    localDraft.serverRevision !== serverRevision ||
    !answersEqual(merged, serverAnswers) ||
    (serverRevision === 0 && Object.keys(merged).length > 0);

  return {
    answers: merged,
    baseAnswers: serverRevision > 0 ? serverAnswers : {},
    serverRevision,
    dirty,
  };
}

export function isQuestionId(value) {
  return typeof value === "string" && QUESTION_ID_PATTERN.test(value);
}
