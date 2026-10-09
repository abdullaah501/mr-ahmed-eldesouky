import mongoose from "mongoose";
import Question from "../../models/Question";
import connectToDatabase from "../connectToDb";
import { normalize } from "../../src/question-system/plugins/registry";
import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/essay/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";
import { toRepositoryQuestion } from "./mapper";
import { keysetPaginate } from "./pagination/keysetStrategy";
import { offsetPaginate } from "./pagination/offsetStrategy";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ALLOWED_SORTS = [
  "_id",
  "updatedAt",
  "createdAt",
  "usageCount",
  "difficulty",
  "grade",
];

function validateSort(field) {
  return ALLOWED_SORTS.includes(field) ? field : "updatedAt";
}

export function buildFilter(params) {
  const filter = { status: { $in: ["draft", "active"] } };

  if (params.status && params.status !== "all") {
    filter.status = params.status;
  }

  if (params.type) {
    const types = Array.isArray(params.type) ? params.type : [params.type];
    if (types.length > 0) filter.type = { $in: types };
  }

  if (params.difficulty) {
    const vals = Array.isArray(params.difficulty) ? params.difficulty : [params.difficulty];
    if (vals.length > 0) filter.difficulty = { $in: vals };
  }

  if (params.grade) {
    const vals = Array.isArray(params.grade) ? params.grade : [params.grade];
    if (vals.length > 0) filter.grade = { $in: vals };
  }

  if (params.subject) {
    const vals = Array.isArray(params.subject) ? params.subject : [params.subject];
    if (vals.length > 0) filter.subject = { $in: vals };
  }

  if (params.tags && params.tags.length > 0) {
    filter.tags = { $in: params.tags };
  }

  if (params.source) {
    const vals = Array.isArray(params.source) ? params.source : [params.source];
    if (vals.length > 0) filter.source = { $in: vals };
  }

  if (params.createdBy) {
    filter.createdBy = new mongoose.Types.ObjectId(params.createdBy);
  }

  if (params.search) {
    filter.$text = { $search: params.search };
  }

  return filter;
}

// ── Public API ───────────────────────────────────────────────

export async function searchQuestions(params) {
  await connectToDatabase();

  const sortField = validateSort(params.sort || "updatedAt");
  const sortOrder = params.order === "asc" ? 1 : -1;
  const filter = buildFilter(params);

  const query = Question.find(filter);

  if (params.search) {
    return offsetPaginate(query, params);
  }

  return keysetPaginate(query, params, sortField, sortOrder);
}

export async function getQuestionById(id) {
  await connectToDatabase();
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const doc = await Question.findById(id).lean();
  return doc ? toRepositoryQuestion(doc) : null;
}

export async function createQuestion({ data, userId }) {
  await connectToDatabase();

  const type = data.type;
  if (!type) throw new Error("Question type is required");

  const normalized = normalize(type, data);
  normalized.createdBy = userId;
  normalized.source = normalized.source || "manual";
  normalized.status = normalized.status || "active";
  normalized.version = 1;
  normalized.usageCount = 0;

  const doc = await Question.create([normalized]);
  return toRepositoryQuestion(doc[0]);
}

export async function updateQuestion({ id, data, userId }) {
  await connectToDatabase();

  if (!id || !mongoose.isValidObjectId(id)) throw new Error("Invalid question id");

  const existing = await Question.findById(id);
  if (!existing) throw new Error("Question not found");

  const type = data.type || existing.type;
  const normalized = normalize(type, { ...existing.toObject(), ...data, _id: id });

  const updated = await Question.findByIdAndUpdate(
    id,
    {
      $set: {
        ...normalized,
        version: (existing.version || 1) + 1,
        updatedBy: userId,
      },
    },
    { new: true }
  ).lean();

  return toRepositoryQuestion(updated);
}

export async function softDeleteQuestion(id, userId) {
  await connectToDatabase();
  const updated = await Question.findByIdAndUpdate(
    id,
    { $set: { status: "deleted", deletedAt: new Date(), updatedBy: userId } },
    { new: true }
  ).lean();
  return updated ? toRepositoryQuestion(updated) : null;
}

export async function archiveQuestion(id, userId) {
  await connectToDatabase();
  const updated = await Question.findByIdAndUpdate(
    id,
    { $set: { status: "archived", updatedBy: userId } },
    { new: true }
  ).lean();
  return updated ? toRepositoryQuestion(updated) : null;
}

export async function restoreQuestion(id, userId) {
  await connectToDatabase();
  const updated = await Question.findByIdAndUpdate(
    id,
    {
      $set: { status: "active", deletedAt: null, updatedBy: userId },
      $unset: { deletedAt: "" },
    },
    { new: true }
  ).lean();
  return updated ? toRepositoryQuestion(updated) : null;
}

export async function duplicateQuestion(id, userId) {
  await connectToDatabase();
  const existing = await Question.findById(id).lean();
  if (!existing) throw new Error("Question not found");

  const copy = {
    questionText: existing.questionText,
    type: existing.type,
    image: existing.image,
    correctAnswer: existing.correctAnswer,
    options: existing.options,
    config: existing.config,
    difficulty: existing.difficulty,
    category: existing.category,
    tags: existing.tags,
    estimatedTime: existing.estimatedTime,
    grade: existing.grade,
    subject: existing.subject,
    unit: existing.unit,
    topic: existing.topic,
    source: "manual",
    status: "active",
    version: 1,
    usageCount: 0,
    createdBy: userId,
  };

  const doc = await Question.create([copy]);
  return toRepositoryQuestion(doc[0]);
}

export async function bulkDeleteQuestions(ids, userId) {
  await connectToDatabase();
  const objectIds = ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  const result = await Question.updateMany(
    { _id: { $in: objectIds } },
    { $set: { status: "deleted", deletedAt: new Date(), updatedBy: userId } }
  );
  return { modifiedCount: result.modifiedCount };
}

export async function bulkArchiveQuestions(ids, userId) {
  await connectToDatabase();
  const objectIds = ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  const result = await Question.updateMany(
    { _id: { $in: objectIds } },
    { $set: { status: "archived", updatedBy: userId } }
  );
  return { modifiedCount: result.modifiedCount };
}

export async function getRepositoryStats(options = {}) {
  await connectToDatabase();

  // Optional grade scope (grade NAME values, matching Question.grade) so the
  // reported total uses the same filtering semantics as the search list.
  const gradeMatch = options.grade?.length
    ? { grade: { $in: options.grade } }
    : {};

  const [byStatus, byType, bySource, byDifficulty, total] = await Promise.all([
    Question.aggregate([
      { $match: gradeMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Question.aggregate([
      { $match: { status: { $in: ["draft", "active"] }, ...gradeMatch } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    Question.aggregate([
      { $match: { status: { $in: ["draft", "active"] }, ...gradeMatch } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]),
    Question.aggregate([
      { $match: { status: { $in: ["draft", "active"] }, ...gradeMatch } },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]),
    Question.countDocuments({
      status: { $in: ["draft", "active"] },
      ...gradeMatch,
    }),
  ]);

  return {
    total,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id || "unknown", s.count])),
    byType: Object.fromEntries(byType.map((t) => [t._id || "unknown", t.count])),
    bySource: Object.fromEntries(bySource.map((s) => [s._id || "unknown", s.count])),
    byDifficulty: Object.fromEntries(byDifficulty.map((d) => [d._id || "unknown", d.count])),
  };
}

export async function getQuestionsByIds(ids) {
  await connectToDatabase();
  const objectIds = ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (objectIds.length === 0) return [];
  const docs = await Question.find({ _id: { $in: objectIds }, status: { $ne: "deleted" } }).lean();
  return docs.map(toRepositoryQuestion);
}

// ── Import API ──────────────────────────────────────────────

export async function isAlreadyImported(importSource, importSourceId) {
  await connectToDatabase();
  if (!importSource || !importSourceId) return false;
  const count = await Question.countDocuments({
    importSource,
    importSourceId,
  });
  return count > 0;
}

export async function bulkCreateQuestions(items, { userId, batchSize = 100 } = {}) {
  await connectToDatabase();

  const normalized = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const data = items[i];
    const type = data.type;
    if (!type) {
      errors.push({ index: i, message: "Question type is required" });
      continue;
    }
    try {
      const norm = normalize(type, data);
      norm.createdBy = userId;
      norm.source = norm.source || "manual";
      norm.status = norm.status || "active";
      norm.version = 1;
      norm.usageCount = 0;
      normalized.push(norm);
    } catch (e) {
      errors.push({ index: i, message: e.message });
    }
  }

  const inserted = [];
  const batches = [];
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize);
    const batchResult = { batchIndex: Math.floor(i / batchSize), attempted: batch.length, inserted: 0, failed: 0 };
    try {
      const docs = await Question.insertMany(batch, { ordered: false });
      inserted.push(...docs);
      batchResult.inserted = docs.length;
    } catch (e) {
      if (e.writeErrors && Array.isArray(e.writeErrors)) {
        batchResult.failed = e.writeErrors.length;
        batchResult.inserted = batch.length - e.writeErrors.length;
        if (e.insertedDocs) inserted.push(...e.insertedDocs);
        for (const we of e.writeErrors) {
          errors.push({
            index: i + (we.index || 0),
            message: we.err?.message || "Insert failed",
          });
        }
      } else {
        batchResult.failed = batch.length;
        errors.push({ index: i, message: e.message || "Batch insert failed" });
      }
    }
    batches.push(batchResult);
  }

  return {
    insertedCount: inserted.length,
    errors,
    items: inserted.map(toRepositoryQuestion),
    batches,
  };
}
