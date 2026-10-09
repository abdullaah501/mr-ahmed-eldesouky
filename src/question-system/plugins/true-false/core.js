import { register } from "../registry";
import {
  answerDescriptor,
  candidateDescriptor,
  compactDescriptors,
  formatTrueFalseAnswer,
} from "../docxDescriptors";

const plugin = {
  type: "true-false",
  apiVersion: 1,
  features: ["image"],
  version: 1,
  meta: { hasOptions: false, gradeable: true, label: "صح / خطأ" },

  blank() {
    return {
      questionText: "",
      type: "true-false",
      image: null,
      correctAnswer: "",
    };
  },

  validate(input) {
    const errors = [];
    if (!input.questionText?.trim()) errors.push("Question text is required");
    if (!input.correctAnswer?.trim()) errors.push("Correct answer is required");
    return { ok: errors.length === 0, errors };
  },

  normalize(input) {
    const { key, _id, id, ...rest } = input;
    // Safety-net at the plugin's normalization boundary: canonical values are
    // the strings "true"/"false"; only approved legacy/localized aliases are
    // mapped. Unknown values flow through unchanged into existing validation.
    const TRUE_ALIASES = new Set(["صح", "نعم", "yes"]);
    const FALSE_ALIASES = new Set(["خطأ", "لا", "no"]);
    const raw = String(rest.correctAnswer ?? "").trim();
    const lower = raw.toLowerCase();
    let correctAnswer = raw;
    if (lower === "true" || lower === "false") correctAnswer = lower;
    else if (TRUE_ALIASES.has(lower)) correctAnswer = "true";
    else if (FALSE_ALIASES.has(lower)) correctAnswer = "false";
    return {
      ...rest,
      questionText: (rest.questionText || "").trim(),
      correctAnswer,
    };
  },

  grade(question, answer) {
    const a = String(answer ?? "").trim().toLowerCase();
    const c = String(question.correctAnswer ?? "").trim().toLowerCase();
    return { isCorrect: a === c };
  },

  toDocxContent(question, context = {}) {
    const descriptors = [
      candidateDescriptor("صح"),
      candidateDescriptor("خطأ"),
    ];
    if (context.includeAnswers) {
      descriptors.push(
        answerDescriptor(formatTrueFalseAnswer(question.correctAnswer))
      );
    }
    return compactDescriptors(descriptors);
  },
};

register(plugin);
export default plugin;
