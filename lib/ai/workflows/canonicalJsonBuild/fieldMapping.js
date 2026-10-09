import { SUBJECTS } from "../../../../constants/subjects";
import { DIFFICULTY_LEVELS } from "../../../../constants/questionDifficulty";
import Grade from "../../../../models/Grade";
import connectToDatabase from "../../../connectToDb";

let gradesCache = null;
let gradesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getGrades() {
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

function unwrapValue(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

function comparable(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ");
}

function canonicalString(value, values) {
  const candidate = unwrapValue(value);
  if (candidate == null || candidate === "") return null;
  const exact = values.find((item) => item === candidate);
  if (exact) return exact;
  const normalized = comparable(candidate);
  return values.find((item) => comparable(item) === normalized) || null;
}

function canonicalDifficulty(value) {
  const candidate = unwrapValue(value);
  if (candidate == null || candidate === "") return null;
  const exact = DIFFICULTY_LEVELS.find((item) => item.value === candidate);
  if (exact) return exact.value;
  const normalized = comparable(candidate);
  const match = DIFFICULTY_LEVELS.find((item) => comparable(item.label) === normalized);
  return match?.value || null;
}

function firstCanonical(values, resolver) {
  for (const value of values) {
    const resolved = resolver(value);
    if (resolved) return resolved;
  }
  return null;
}

function firstRaw(values) {
  for (const value of values) {
    const candidate = unwrapValue(value);
    if (candidate != null && candidate !== "") return candidate;
  }
  return null;
}

function resolveCanonicalWithFallback(values, resolver, fallback = null) {
  return firstCanonical(values, resolver) || firstRaw(values) || fallback;
}

export async function mapDraftQuestionToCanonical(draft, ctx) {
  const meta = ctx.provenance || {};
  const params = ctx.params || {};
  const context = ctx.context || {};
  const defaults = ctx.defaults || {};

  const grades = await getGrades();
  const grade = resolveCanonicalWithFallback([draft.grade, params.grade, context.grade, defaults.grade], (value) => canonicalString(value, grades));
  const subject = resolveCanonicalWithFallback([draft.subject, params.subject, context.subject, defaults.subject], (value) => canonicalString(value, SUBJECTS));
  const difficulty = resolveCanonicalWithFallback([draft.difficulty, params.difficulty, defaults.difficulty], canonicalDifficulty, "medium");

  const question = {
    type: draft.type,
    questionText: draft.questionText,
    correctAnswer: draft.correctAnswer || "",
    image: draft.image || {},
    aiProvider: meta.aiProvider || null,
    aiModel: meta.aiModel || null,
    aiPromptId: meta.aiPromptId || "question-generation",
    aiPromptVersion: meta.aiPromptVersion || null,
    difficulty,
    grade,
    subject,
  };

  if (draft.options) {
    question.options = draft.type === "fill-blank"
      ? draft.options.map((option, index) => ({
        id: option.id || `answer-${index + 1}`,
        text: option.text || "",
        isCorrect: option.isCorrect === true,
      }))
      : draft.options.map((option) => ({ optionText: option.optionText || "", valueText: option.valueText || "" }));
  }
  if (draft.config) question.config = draft.config;
  if (draft.unit) question.unit = draft.unit;
  if (draft.topic) question.topic = draft.topic;
  if (Array.isArray(draft.tags)) question.tags = draft.tags;
  if (draft.estimatedTime != null) question.estimatedTime = draft.estimatedTime;

  return question;
}

export async function buildCanonicalJson(draftQuestions, ctx) {
  const grades = await getGrades();
  const questions = [];
  for (const q of draftQuestions) {
    questions.push(await mapDraftQuestionToCanonical(q, ctx));
  }
  const meta = ctx.provenance || {};
  const params = ctx.params || {};
  const context = ctx.context || {};
  const defaults = {
    grade: resolveCanonicalWithFallback([params.grade, context.grade], (value) => canonicalString(value, grades)),
    subject: resolveCanonicalWithFallback([params.subject, context.subject], (value) => canonicalString(value, SUBJECTS)),
    difficulty: resolveCanonicalWithFallback([params.difficulty], canonicalDifficulty, "medium"),
    tags: params.tags || [],
  };

  return {
    questions,
    defaults,
    _meta: {
      schemaVersion: "2",
      generatedAt: new Date().toISOString(),
      generator: {
        provider: meta.aiProvider || null,
        model: meta.aiModel || null,
        promptVersion: meta.aiPromptVersion || null,
        schemaVersion: "2",
      },
      feature: ctx.feature || "repository",
    },
  };
}