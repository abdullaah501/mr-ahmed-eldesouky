export const SCHEMA_ID = "draft-questions";
export const SCHEMA_VERSION = "2";

const FEASIBLE_TYPES = new Set(["multiple-choice", "true-false", "essay", "fill-blank", "matching"]);

function isObj(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function assertDraftQuestions(value) {
  if (!Array.isArray(value)) {
    return { ok: false, errors: ["DraftQuestions must be an array"] };
  }
  const errors = [];

  for (let i = 0; i < value.length; i++) {
    const q = value[i];
    if (!isObj(q)) {
      errors.push(`question[${i}] must be an object`);
      continue;
    }
    if (!FEASIBLE_TYPES.has(q.type)) {
      errors.push(`question[${i}].type "${q.type}" is not a feasible AI type (image-choice excluded)`);
    }
    if (typeof q.questionText !== "string" || !q.questionText.trim()) {
      errors.push(`question[${i}].questionText is required`);
    }
    if (typeof q.type === "string" && FEASIBLE_TYPES.has(q.type)) {
      errors.push(...checkTypeMinimums(q, i));
    }
  }

  return { ok: errors.length === 0, errors };
}

function checkTypeMinimums(q, i) {
  const errors = [];
  switch (q.type) {
    case "multiple-choice": {
      const opts = q.options;
      if (!Array.isArray(opts) || opts.length < 2) {
        errors.push(`question[${i}] multiple-choice requires options[] with at least 2 entries`);
      }
      if (!q.correctAnswer || typeof q.correctAnswer !== "string") {
        errors.push(`question[${i}] multiple-choice requires a string correctAnswer`);
      } else if (Array.isArray(opts) && !opts.some((option) => option?.valueText === q.correctAnswer)) {
        errors.push(`question[${i}] multiple-choice correctAnswer must match an options[].valueText`);
      }
      break;
    }
    case "true-false": {
      if (!q.correctAnswer) {
        errors.push(`question[${i}] true-false requires a correctAnswer`);
      }
      break;
    }
    case "essay": {
      // AI-generation requirement: an essay draft is incomplete without its
      // model answer. (The Essay PLUGIN still accepts empty answers for
      // manually authored questions — this boundary is AI-output only.)
      if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim()) {
        errors.push(`question[${i}] essay requires a non-empty model answer (correctAnswer)`);
      }
      break;
    }
    case "fill-blank": {
      if (!q.questionText || !q.questionText.includes("____")) {
        errors.push(`question[${i}] fill-blank questionText must contain ____`);
      }
      if (q.config?.answers) {
        errors.push(`question[${i}] fill-blank must not use config.answers; use options[]`);
      }
      const options = q.options;
      if (!Array.isArray(options)) {
        errors.push(`question[${i}] fill-blank requires options[]`);
        break;
      }
      if (options.length < 3) {
        errors.push(`question[${i}] fill-blank requires at least 3 options`);
      }
      const texts = options.map((option) => String(option?.text || "").trim());
      if (options.some((option, optionIndex) => !isObj(option) || !texts[optionIndex])) {
        errors.push(`question[${i}] fill-blank options must have non-empty text`);
      }
      if (new Set(texts.filter(Boolean)).size !== texts.filter(Boolean).length) {
        errors.push(`question[${i}] fill-blank options must not contain duplicate text`);
      }
      if (options.some((option) => typeof option?.isCorrect !== "boolean")) {
        errors.push(`question[${i}] fill-blank options must declare isCorrect`);
      }
      const correct = options.filter((option) => option?.isCorrect === true);
      if (correct.length !== 1) {
        errors.push(`question[${i}] fill-blank requires options[] with exactly 1 isCorrect`);
      }
      if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim()) {
        errors.push(`question[${i}] fill-blank requires a correctAnswer string`);
      } else if (correct.length === 1 && correct[0].text?.trim() !== q.correctAnswer.trim()) {
        errors.push(`question[${i}] fill-blank correctAnswer must match the correct option text`);
      }
      break;
    }
    case "matching": {
      const pairs = q.config?.pairs;
      if (!Array.isArray(pairs) || pairs.length < 2) {
        errors.push(`question[${i}] matching requires config.pairs[] with at least 2 entries`);
      }
      break;
    }
    default:
      break;
  }
  return errors;
}

export const schema = {
  id: SCHEMA_ID,
  version: SCHEMA_VERSION,
  assert: assertDraftQuestions,
};

export default schema;
