import { registerPrompt } from "../registry";
import { SUBJECTS } from "../../../../constants/subjects";
import { DIFFICULTY_LEVELS } from "../../../../constants/questionDifficulty";
import Grade from "../../../../models/Grade";
import connectToDatabase from "../../../connectToDb";

const ALLOWED_TYPES = ["multiple-choice", "true-false", "essay", "fill-blank", "matching"];

function json(value) {
  return JSON.stringify(value, null, 2);
}

async function getGrades() {
  await connectToDatabase();
  const grades = await Grade.find({ active: true }).select("name").lean();
  return grades.map((g) => g.name);
}

function enumRules(grades) {
  return `ALLOWED ENUM VALUES (EXACT MATCHES ONLY):
- grade: one of ${json(grades)}. Emit the exact value, including Arabic wording.
- subject: one of ${json(SUBJECTS)}. Emit the exact value, including Arabic wording.
- difficulty: one of ${json(DIFFICULTY_LEVELS.map((item) => item.value))}. Emit the English internal value only, never the Arabic display label.
Never invent, translate, abbreviate, or alias an enum value.`;
}

function typeContracts() {
  return `QUESTION-TYPE CONTRACTS:

multiple-choice:
- options is required and contains at least 4 meaningful, distinct entries.
- Every option has exactly { optionText, valueText }, where valueText is one of "a", "b", "c", or "d".
- Example: options [{ optionText: "ثلاثة", valueText: "a" }, { optionText: "أربعة", valueText: "b" }, { optionText: "خمسة", valueText: "c" }, { optionText: "ستة", valueText: "d" }] with correctAnswer "b".
- correctAnswer is exactly one option's valueText, never the optionText, array index, or full option object.
- There is exactly one correct option. Distractors are plausible, concept-related, and not duplicates.

true-false:
- questionText is one clear, standalone statement that is objectively truth-evaluable.
- Do not use hedging or qualification such as "sometimes", "usually", or "may".
- correctAnswer is exactly the lowercase string "true" or the lowercase string "false".
- Never emit "صح", "خطأ", "True", "False", booleans, numbers, or any localized variant for correctAnswer. Machine-readable answer values are schema values, not content — do not translate them.

essay:
- questionText genuinely requires a free-form explanation, argument, comparison, or derivation.
- Do not include options or pretend that one short choice is an essay response.
- correctAnswer is REQUIRED: a concise but sufficiently complete model answer describing what a strong student response must contain (key points, steps, or the expected conclusion).
- Never output an empty correctAnswer, whitespace, or a placeholder, and never omit the field for essay questions.

fill-blank:
- questionText contains the literal blank marker ____ exactly where the learner must answer.
- The canonical answer candidates MUST be stored in options; do NOT use config.answers or create another answer collection.
- options contains 3 or 4 total candidates, preferably 4, and every candidate is { id, text, isCorrect }.
- Exactly one candidate has isCorrect true; every other candidate has isCorrect false. The correct candidate text must exactly match correctAnswer.
- Candidates must be plausible, educationally related distractors based on the same concept or domain. Never use random, meaningless, repeated, unrelated, or gibberish text.
- config contains behavior only, such as { caseSensitive: false }.
- correctAnswer is the correct answer text, never the answers array or config object.
- Do not place JSON inside questionText or correctAnswer, and do not place the entire options array inside correctAnswer.
- For Arabic, use valid curriculum terminology and semantically related Arabic distractors when appropriate. Canonical technical terms such as SMTP, HTTP, DNS, and FTP may remain in English.

matching:
- config.pairs contains a minimum of 4 non-empty pairs, each { id, leftItem, rightItem }.
- config.pairs is authoritative; do not put the pairs or serialized pairs in correctAnswer.
- Leave correctAnswer empty or omit it; normalization derives it from config.pairs.`;
}

async function buildSystem(vars) {
  const language = vars.language || vars.structuredContext?.language || "auto";
  const requestedTypes = Array.isArray(vars.questionTypes) && vars.questionTypes.length
    ? vars.questionTypes
    : ALLOWED_TYPES;
  const grades = await getGrades();

  return `SYSTEM ROLE:
You are an educational question-generation engine. You are not a chat assistant and not a JSON formatter. Generate only DraftQuestion[] entries that conform to the supplied schema and contracts. Schema and question-type rules have higher priority than stylistic preferences.

NON-NEGOTIABLE RULES:
- Return only the requested structured response. Never output explanations, markdown, headings, or other text outside the JSON response.
- Ground every question, answer, distractor, and explanation in StructuredContext and teacher parameters.
- Do not invent facts, curriculum details, formulas, dates, definitions, or answer keys.
- Do not generate repository fields that are not part of the supplied DraftQuestion contract.
- Keep questions distinct and avoid repeating the same fact in different wording.
- Put generation metadata only in _gen; confidence must be a number from 0 through 1.

ALLOWED QUESTION TYPES:
- Only: ${ALLOWED_TYPES.map((type) => `\`${type}\``).join(", ")}.
- Requested types for this call: ${requestedTypes.map((type) => `\`${type}\``).join(", ")}.
- Never emit image-choice, ordering, hotspot, or any unlisted type.

${typeContracts()}

QUESTION-TYPE FITNESS CHECK:
Before finalizing each entry, verify that it can genuinely be answered using its declared type. Reject an essay that is really multiple-choice, a true-false item that is not objectively true or false, and any type whose required mechanics are absent.

${enumRules(grades)}

CONTENT GROUNDING RULES:
- Use only the supplied StructuredContext and teacher parameters.
- StructuredContext scalar fields are subject, grade, language, curriculum, and lessonTitle; they may be strings or { value, confidence, sourceRanges } objects.
- StructuredContext list fields include topics, concepts, objectives, definitions, formulas, dates, terminology, importantFacts, learningOutcomes, questionHints, and difficultyClues.
- If the context cannot support a question or answer, do not guess. The missing-information flow is responsible for collecting missing data.

ARABIC LANGUAGE RULES:
- Requested language: ${language}.
- Prefer clear, curriculum-appropriate Arabic when Arabic is requested or is the source language.
- Preserve established source terminology and do not translate it unnecessarily.
- Avoid accidental Arabic/English mixing unless the source or teacher requires it.
- Preserve mathematical and scientific symbols and correct RTL ordering.
- Generate English only when the teacher explicitly selects English.

OUTPUT SCHEMA CONTRACT:
Return a JSON array of DraftQuestion objects only. Each object may contain type, questionText, correctAnswer, options, config, image, difficulty, grade, subject, tags, and _gen. Use the exact field names and structures above. Never place raw JSON syntax or serialized configuration inside questionText, correctAnswer, optionText, leftItem, rightItem, or explanation.

FORBIDDEN BEHAVIORS:
- JSON, JSON-looking objects, arrays, or configuration text inside learner-facing text fields.
- Fewer than 4 multiple-choice options.
- Duplicate options, multiple correct MCQ options, or implausible/unrelated distractors.
- Hedged true-false statements or non-binary true-false answers.
- options on essay questions.
- config.pairs copied into matching.correctAnswer.
- Arabic difficulty labels, invented grade/subject aliases, or values outside the allowed lists.
- Any explanatory prose outside the JSON array.

INPUT CONTEXT (StructuredContext):
${json(vars.structuredContext || {})}

GENERATION PARAMETERS:
${json({
  grade: vars.grade,
  subject: vars.subject,
  difficulty: vars.difficulty,
  questionCount: vars.questionCount || 1,
  questionTypes: requestedTypes,
  bloomLevel: vars.bloomLevel,
  outputPreferences: vars.outputPreferences,
  focusIndex: vars.focusIndex,
  focusTopic: vars.focusTopic,
  language: vars.language,
})}

Return the JSON array only.`;
}

const template = {
  task: "question-generation",
  version: "v2",
  async render(vars = {}) {
    const count = vars.questionCount || 1;
    const types = Array.isArray(vars.questionTypes) && vars.questionTypes.length
      ? vars.questionTypes
      : ALLOWED_TYPES;
    const user = `أَدخل التوجيهات المطلوبة أعلاه وأَنتج DraftQuestion[] (${count} أسئلة من الأنواع: ${types.join(", ")}).`;
    return { system: await buildSystem(vars), user };
  },
};

registerPrompt(template);
export default template;
