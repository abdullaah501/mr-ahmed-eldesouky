import "server-only";
import mongoose from "mongoose";
import Question from "../../models/Question";
import { buildFilter } from "./questionService";
import { getStaffedGradeNames } from "./staffScope";
import { MAX_EXPORT_QUESTIONS, EXPORT_FILTER_KEYS } from "./exportSelection";

const QUESTION_ID_PATTERN = /^[a-f0-9]{24}$/i;
const MAX_FILTER_VALUES = 50;
const MAX_FILTER_LENGTH = 200;

function sanitizeIdList(value, cap) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const raw of value) {
    if (typeof raw !== "string" || !QUESTION_ID_PATTERN.test(raw)) continue;
    seen.add(raw);
    if (seen.size >= cap) break;
  }
  return [...seen];
}

function sanitizeFilterValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, MAX_FILTER_LENGTH) : undefined;
  }
  if (Array.isArray(value)) {
    const out = value
      .filter((item) => typeof item === "string" && item.trim())
      .slice(0, MAX_FILTER_VALUES)
      .map((item) => item.trim().slice(0, MAX_FILTER_LENGTH));
    return out.length > 0 ? out : undefined;
  }
  return undefined;
}

function sanitizeFilters(raw) {
  const filters = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return filters;
  for (const key of EXPORT_FILTER_KEYS) {
    const value = sanitizeFilterValue(raw[key]);
    if (value !== undefined) filters[key] = value;
  }
  return filters;
}

/**
 * Assistant scope and the user's requested grade filter are INTERSECTED —
 * the requested filter is never overwritten by the scope.
 */
function applyAssistantScope(filter, scopeGradeNames) {
  const requested = Array.isArray(filter.grade?.$in) ? filter.grade.$in : null;
  const allowed = requested
    ? requested.filter((name) => scopeGradeNames.includes(name))
    : scopeGradeNames.slice();
  if (allowed.length === 0) return null;
  filter.grade = { $in: allowed };
  return filter;
}

/**
 * Builds the authoritative export query, bounded to MAX_EXPORT_QUESTIONS.
 * The browser only contributes ids or a filter snapshot; Question content is
 * always loaded from the database.
 */
export async function resolveExportQuestions({ user, request }) {
  const payload = request && typeof request === "object" ? request : {};
  const includeAnswers = payload.includeAnswers === true;
  const mode =
    payload.mode === "allFiltered"
      ? "allFiltered"
      : payload.mode === "explicit"
        ? "explicit"
        : null;

  if (!mode) {
    return { success: false, status: 400, message: "Invalid export mode" };
  }

  let scopeGradeNames = null;
  if (user.role === "assistant") {
    scopeGradeNames = await getStaffedGradeNames(user._id);
    if (scopeGradeNames.length === 0) {
      return { success: true, questions: [], total: 0, includeAnswers };
    }
  }

  if (mode === "explicit") {
    const ids = sanitizeIdList(payload.selectedIds, MAX_EXPORT_QUESTIONS + 1);
    if (ids.length === 0) {
      return { success: false, status: 400, message: "No questions selected" };
    }
    if (ids.length > MAX_EXPORT_QUESTIONS) {
      return {
        success: false,
        status: 400,
        code: "EXPORT_LIMIT_EXCEEDED",
        message: `Select up to ${MAX_EXPORT_QUESTIONS} questions per export`,
      };
    }

    const filter = {
      ...buildFilter({}),
      _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    };
    if (scopeGradeNames && !applyAssistantScope(filter, scopeGradeNames)) {
      return { success: true, questions: [], total: 0, includeAnswers };
    }

    const questions = await Question.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(MAX_EXPORT_QUESTIONS)
      .lean();
    return { success: true, questions, total: questions.length, includeAnswers };
  }

  // allFiltered — filters are the selection; exclusions are bounded.
  const filters = sanitizeFilters(payload.filters);
  const excludedIds = sanitizeIdList(payload.excludedIds, MAX_EXPORT_QUESTIONS + 1);
  if (excludedIds.length > MAX_EXPORT_QUESTIONS) {
    return {
      success: false,
      status: 400,
      message: `Too many exclusions (max ${MAX_EXPORT_QUESTIONS})`,
    };
  }

  const filter = buildFilter(filters);
  if (scopeGradeNames && !applyAssistantScope(filter, scopeGradeNames)) {
    return { success: true, questions: [], total: 0, includeAnswers };
  }
  if (excludedIds.length > 0) {
    filter._id = {
      $nin: excludedIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  const total = await Question.countDocuments(filter);
  if (total > MAX_EXPORT_QUESTIONS) {
    return {
      success: false,
      status: 400,
      code: "EXPORT_LIMIT_EXCEEDED",
      message: `More than ${MAX_EXPORT_QUESTIONS} questions match — narrow the filters and try again`,
    };
  }

  // Deterministic export ordering. The interactive list uses textScore order
  // for $text search; exports always use updatedAt/_id so the document order
  // is reproducible (documented intentional difference).
  const questions = await Question.find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(MAX_EXPORT_QUESTIONS)
    .lean();
  return { success: true, questions, total, includeAnswers };
}
