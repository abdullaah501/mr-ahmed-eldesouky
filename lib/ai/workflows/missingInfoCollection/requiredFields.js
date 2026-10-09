import { SUBJECTS } from "../../../../constants/subjects";
import { DIFFICULTY_LEVELS } from "../../../../constants/questionDifficulty";
import { BLOOM_LEVELS } from "../../../../constants/bloomLevels";
import Grade from "../../../../models/Grade";
import connectToDatabase from "../../../connectToDb";

export const FIELD_KEY = {
  SUBJECT: "subject",
  GRADE: "grade",
  LESSON_TITLE: "lessonTitle",
  DIFFICULTY: "difficulty",
  CURRICULUM: "curriculum",
  LANGUAGE: "language",
  QUESTION_COUNT: "questionCount",
  QUESTION_TYPES: "questionTypes",
  BLOOM_LEVEL: "bloomLevel",
  OUTPUT_PREFERENCES: "outputPreferences",
};

const FEASIBLE_QUESTION_TYPES = [
  "multiple-choice",
  "true-false",
  "essay",
  "fill-blank",
  "matching",
];

// Grade options come from the Grade collection (same source of truth as
// canonicalJsonBuild/fieldMapping). No hardcoded fallback.
let gradesCache = null;
let gradesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getActiveGradeNames() {
  const now = Date.now();
  if (gradesCache && now - gradesCacheTime < CACHE_TTL) {
    return gradesCache;
  }
  await connectToDatabase();
  const grades = await Grade.find({ active: true }).select("name").lean();
  gradesCache = grades.map((g) => g.name);
  gradesCacheTime = Date.now();
  return gradesCache;
}

const REQUIRED_FIELDS_BASE = [
  { key: "grade", priority: 1, required: true, editable: true, label: "Grade", source: "context" },
  { key: "subject", priority: 2, required: true, editable: true, label: "Subject", source: "context", options: SUBJECTS },
  { key: "lessonTitle", priority: 3, required: false, editable: true, label: "Lesson title", source: "context" },
  { key: "difficulty", priority: 4, required: true, editable: true, label: "Difficulty", source: "params", options: ["easy", "medium", "hard"] },
  { key: "questionCount", priority: 5, required: true, editable: true, label: "Number of questions", source: "params" },
  { key: "questionTypes", priority: 6, required: true, editable: true, label: "Question types", source: "params", options: ["multiple-choice", "true-false", "essay", "fill-blank", "matching"] },
  { key: "bloomLevel", priority: 7, required: false, editable: true, label: "Bloom level", source: "params", options: ["remember", "understand", "apply", "analyze", "evaluate", "create"] },
  { key: "outputPreferences", priority: 8, required: false, editable: true, label: "Output preferences", source: "params" },
  { key: "language", priority: 9, required: false, editable: true, label: "Language", source: "context" },
];

/**
 * Required-fields definitions with live grade options. When the collection has
 * zero active grades the grade field degrades to free-form (no options), never
 * falling back to constants.
 */
export async function getRequiredFields() {
  const gradeNames = await getActiveGradeNames();
  if (gradeNames.length === 0) return REQUIRED_FIELDS_BASE;
  return REQUIRED_FIELDS_BASE.map((f) =>
    f.key === FIELD_KEY.GRADE ? { ...f, options: gradeNames } : f
  );
}

export { FEASIBLE_QUESTION_TYPES };
