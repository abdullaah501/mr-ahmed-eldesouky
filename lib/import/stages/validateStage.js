import { validate } from "../../../src/question-system/plugins/registry";
import { SUBJECTS } from "../../../constants/subjects";
import { DIFFICULTY_LEVELS } from "../../../constants/questionDifficulty";
import Grade from "../../../models/Grade";
import connectToDatabase from "../../../lib/connectToDb";

const ALLOWED_DIFFICULTIES = DIFFICULTY_LEVELS.map((d) => d.value);

let gradesCache = null;
let gradesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getActiveGrades() {
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

export async function validateStage(ctx) {
  await connectToDatabase();
  const allowedGrades = await getActiveGrades();
  
  const errors = [];
  const warnings = [];
  const valid = [];

  for (let i = 0; i < ctx.questions.length; i++) {
    const q = ctx.questions[i];
    const itemErrors = [];

    if (!q.type) {
      itemErrors.push({ code: "MISSING_TYPE", message: "Question type is required", questionIndex: i, stage: "validate" });
    } else {
      const result = validate(q.type, q);
      if (!result.ok) {
        for (const msg of result.errors) {
          itemErrors.push({ code: "PLUGIN_VALIDATION", message: msg, questionIndex: i, stage: "validate" });
        }
      }
    }

    if (q.difficulty && !ALLOWED_DIFFICULTIES.includes(q.difficulty)) {
      itemErrors.push({ code: "INVALID_DIFFICULTY", message: `Unknown difficulty level: "${q.difficulty}"`, questionIndex: i, stage: "validate" });
    }
    if (q.grade && !allowedGrades.includes(q.grade)) {
      warnings.push({ code: "UNKNOWN_GRADE", message: `Unknown grade: "${q.grade}"`, questionIndex: i, stage: "validate" });
    }
    if (q.subject && !SUBJECTS.includes(q.subject)) {
      warnings.push({ code: "UNKNOWN_SUBJECT", message: `Unknown subject: "${q.subject}"`, questionIndex: i, stage: "validate" });
    }

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
      ctx.stats.failed++;
    } else {
      valid.push(q);
    }
  }

  ctx.validQuestions = valid;
  ctx.stats.validated = valid.length;
  return { success: errors.length === 0, errors, warnings };
}