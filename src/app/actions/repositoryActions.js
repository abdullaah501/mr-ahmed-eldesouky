"use server";

import Hashids from "hashids";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";
import {
  searchQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  softDeleteQuestion,
  archiveQuestion,
  restoreQuestion,
  duplicateQuestion,
  bulkDeleteQuestions,
  bulkArchiveQuestions,
  getRepositoryStats,
  getQuestionsByIds,
} from "../../../lib/repository/questionService";
import { ImportEngine } from "../../../lib/import/core/ImportEngine";
import { getImportObject } from "../../../lib/import/storage/fetchObject";
import { deleteImportObject } from "../../../lib/import/storage/deleteObject";
import { getStaffedGradeNames } from "../../../lib/repository/staffScope";

function requireAdminOrAssistant(user) {
  if (!user || (user.role !== "admin" && user.role !== "assistant")) {
    return false;
  }
  return true;
}

const ALLOWED_CLEANUP_POLICIES = new Set(["always", "never", "failed_only"]);

function resolveCleanupPolicy() {
  const raw = (process.env.IMPORT_CLEANUP_POLICY || "always").trim().toLowerCase();
  return ALLOWED_CLEANUP_POLICIES.has(raw) ? raw : "always";
}

const activeImports = new Map();

export async function searchRepositoryQuestions(params) {
  const { success, user, newAccessToken } = await withCaller(
    "repo_search_questions",
    () => withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const scoped = { ...(params || {}) };

    // Assistants are scoped by GradeStaffAssignment grades (one $in query —
    // never by question authorship, and never client-supplied grade lists).
    // Question.grade stores the grade NAME, so ObjectIds resolve to names.
    if (user.role === "assistant") {
      const gradeNames = await getStaffedGradeNames(user._id);
      if (gradeNames.length === 0) {
        // Legitimate empty result — 200 with no items, not an error.
        return { success: true, items: [], nextCursor: null };
      }
      scoped.grade = gradeNames;
    }

    const result = await searchQuestions(scoped);
    return { success: true, ...result };
  } catch (error) {
    console.error("searchRepositoryQuestions error:", error);
    return { success: false, message: "Error searching questions", items: [], nextCursor: null };
  }
}

export async function getRepositoryQuestion(id) {
  const { success, user } = await withCaller("repo_get_question", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await getQuestionById(id);
    if (!question) return { success: false, message: "Question not found" };
    return { success: true, question };
  } catch (error) {
    return { success: false, message: "Error fetching question" };
  }
}

export async function createRepositoryQuestion(data) {
  const { success, user, newAccessToken } = await withCaller(
    "repo_create_question",
    () => withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await createQuestion({ data, userId: user._id });
    return { success: true, question };
  } catch (error) {
    console.error("createRepositoryQuestion error:", error);
    return { success: false, message: error.message || "Error creating question" };
  }
}

export async function updateRepositoryQuestion({ id, data }) {
  const { success, user } = await withCaller("repo_update_question", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await updateQuestion({ id, data, userId: user._id });
    return { success: true, question };
  } catch (error) {
    console.error("updateRepositoryQuestion error:", error);
    return { success: false, message: error.message || "Error updating question" };
  }
}

export async function deleteRepositoryQuestion(id) {
  const { success, user } = await withCaller("repo_delete_question", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await softDeleteQuestion(id, user._id);
    return { success: true, question };
  } catch (error) {
    return { success: false, message: error.message || "Error deleting question" };
  }
}

export async function archiveRepositoryQuestion(id) {
  const { success, user } = await withCaller("repo_archive_question", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await archiveQuestion(id, user._id);
    return { success: true, question };
  } catch (error) {
    return { success: false, message: error.message || "Error archiving question" };
  }
}

export async function restoreRepositoryQuestion(id) {
  const { success, user } = await withCaller("repo_restore_question", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await restoreQuestion(id, user._id);
    return { success: true, question };
  } catch (error) {
    return { success: false, message: error.message || "Error restoring question" };
  }
}

export async function duplicateRepositoryQuestion(id) {
  const { success, user } = await withCaller("repo_duplicate_question", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const question = await duplicateQuestion(id, user._id);
    return { success: true, question };
  } catch (error) {
    return { success: false, message: error.message || "Error duplicating question" };
  }
}

export async function bulkDeleteRepositoryQuestions(ids) {
  const { success, user } = await withCaller("repo_bulk_delete", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const result = await bulkDeleteQuestions(ids, user._id);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, message: "Error bulk deleting questions" };
  }
}

export async function bulkArchiveRepositoryQuestions(ids) {
  const { success, user } = await withCaller("repo_bulk_archive", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const result = await bulkArchiveQuestions(ids, user._id);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, message: "Error bulk archiving questions" };
  }
}

export async function getRepositoryStatsAction() {
  const { success, user } = await withCaller("repo_stats", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    // Count must share the list's filtering semantics: an assistant's
    // "bank total" is scoped to their staffed grades' questions.
    let scope;
    if (user.role === "assistant") {
      const gradeNames = await getStaffedGradeNames(user._id);
      if (gradeNames.length === 0) {
        // Consistent zeroed scope — no staffed grades, no questions.
        return {
          success: true,
          stats: { total: 0, byStatus: {}, byType: {}, bySource: {}, byDifficulty: {} },
        };
      }
      scope = { grade: gradeNames };
    }
    const stats = await getRepositoryStats(scope);
    return { success: true, stats };
  } catch (error) {
    return { success: false, message: "Error fetching stats" };
  }
}

export async function getRepositoryQuestionsByIds(ids) {
  const { success, user } = await withCaller("repo_get_by_ids", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const questions = await getQuestionsByIds(ids);
    return { success: true, questions };
  } catch (error) {
    return { success: false, message: "Error fetching questions" };
  }
}

export async function importRepositoryQuestions(input) {
  const { success, user, newAccessToken } = await withCaller(
    "import_run",
    () => withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  const { key, filename, filetype, filesize, options } = input || {};

  if (!key || !filename) {
    return {
      success: false,
      report: { imported: 0, failed: 0, skipped: 0, warnings: 0, duration: 0 },
      errors: [{ code: "NO_KEY", message: "File key is required", stage: "server_action" }],
      warnings: [],
      timings: {},
    };
  }

  if (activeImports.has(key)) {
    return {
      success: false,
      report: { imported: 0, failed: 0, skipped: 0, warnings: 0, duration: 0 },
      errors: [{ code: "ALREADY_RUNNING", message: "An import is already running for this file", stage: "server_action" }],
      warnings: [],
      timings: {},
    };
  }

  activeImports.set(key, Date.now());

  let result;

  try {
    const object = await getImportObject(key);

    const fileLike = {
      name: filename,
      type: filetype || "application/octet-stream",
      size: filesize ?? object.contentLength,
      arrayBuffer: async () => object.bytes.buffer,
    };

    result = await ImportEngine.importFile(fileLike, {
      userId: user._id,
      options: options || {},
    });
  } catch (error) {
    console.error("importRepositoryQuestions error:", error);
    result = {
      success: false,
      report: { imported: 0, failed: 0, skipped: 0, warnings: 1, duration: 0 },
      errors: [{ code: "UNEXPECTED", message: error.message || "Unexpected error", stage: "server_action" }],
      warnings: [],
      timings: {},
    };
  } finally {
    activeImports.delete(key);

    const isPreview = options?.dryRun === true;

    if (!isPreview) {
      const policy = resolveCleanupPolicy();
      const shouldDelete =
        policy === "always" ||
        (policy === "failed_only" && (!result || !result.success));

      if (key && shouldDelete) {
        try {
          await deleteImportObject(key);
        } catch (_) {
          // best-effort cleanup; do not mask the import result
        }
      }
    }
  }

  return result;
}

export async function cancelImportUpload(key) {
  const { success, user, newAccessToken } = await withCaller(
    "import_cancel",
    () => withTracePhase("server_action", () => checkUser())
  );

  if (!success || !requireAdminOrAssistant(user)) {
    return { success: false, message: "Unauthorized" };
  }

  if (key) {
    try {
      await deleteImportObject(key);
    } catch (_) {
      // best-effort
    }
  }

  return { success: true };
}