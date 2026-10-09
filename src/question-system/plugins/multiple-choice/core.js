import { register } from "../registry";
import {
  answerDescriptor,
  compactDescriptors,
  optionDescriptor,
  resolveCorrectOptionText,
} from "../docxDescriptors";

const plugin = {
  type: "multiple-choice",
  apiVersion: 1,
  features: ["image", "randomize-options"],
  version: 1,
  meta: { hasOptions: true, gradeable: true, label: "اختيار من متعدد" },

  blank() {
    return {
      questionText: "",
      type: "multiple-choice",
      image: null,
      correctAnswer: "",
      options: [
        { optionText: "", valueText: "a" },
        { optionText: "", valueText: "b" },
        { optionText: "", valueText: "c" },
        { optionText: "", valueText: "d" },
      ],
    };
  },

  validate(input) {
    const errors = [];
    if (!input.questionText?.trim()) errors.push("Question text is required");
    if (!input.correctAnswer?.trim()) errors.push("Correct answer is required");
    if (!input.options || input.options.length < 2) {
      errors.push("At least two options are required");
    } else {
      const hasEmpty = input.options.some((o) => !o.optionText?.trim());
      if (hasEmpty) errors.push("All options are required");
    }
    return { ok: errors.length === 0, errors };
  },

  normalize(input) {
    const { key, _id, id, ...rest } = input;
    const options = (rest.options || []).map((opt) => ({
      optionText: (opt.optionText || "").trim(),
      valueText: opt.valueText || "",
    }));
    return {
      ...rest,
      questionText: (rest.questionText || "").trim(),
      correctAnswer: (rest.correctAnswer || "").trim(),
      options,
    };
  },

  grade(question, answer) {
    const a = String(answer ?? "").trim().toLowerCase();
    const c = String(question.correctAnswer ?? "").trim().toLowerCase();
    return { isCorrect: a === c };
  },

  toDocxContent(question, context = {}) {
    const descriptors = (question.options || []).map((opt, index) =>
      optionDescriptor(index, opt?.optionText || opt?.valueText)
    );
    if (context.includeAnswers) {
      descriptors.push(answerDescriptor(resolveCorrectOptionText(question)));
    }
    return compactDescriptors(descriptors);
  },
};

register(plugin);
export default plugin;
