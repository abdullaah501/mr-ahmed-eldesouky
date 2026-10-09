import { register } from "../registry";
import {
  answerDescriptor,
  compactDescriptors,
  noteDescriptor,
  optionDescriptor,
  resolveCorrectOptionText,
} from "../docxDescriptors";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const plugin = {
  type: "image-choice",
  apiVersion: 1,
  features: ["image"],
  version: 1,
  meta: { hasOptions: true, gradeable: true, label: "اختيار بالصور" },

  blank() {
    return {
      questionText: "",
      type: "image-choice",
      image: null,
      correctAnswer: "",
      options: [
        { optionText: "", valueText: uid(), image: null },
        { optionText: "", valueText: uid(), image: null },
      ],
    };
  },

  validate(input) {
    const errors = [];
    if (!input.questionText?.trim()) errors.push("Question text is required");
    if (!input.correctAnswer?.trim()) errors.push("Correct answer is required");
    const opts = input.options || [];
    if (opts.length < 2) errors.push("At least two options are required");
    else {
      const hasEmpty = opts.some((o) => !o.image?.cloudId && !o.image?.buffer);
      if (hasEmpty) errors.push("An image must be uploaded for each option");
    }
    return { ok: errors.length === 0, errors };
  },

  normalize(input) {
    const { key, _id, id, ...rest } = input;
    const options = (rest.options || []).map((opt) => ({
      optionText: (opt.optionText || "").trim(),
      valueText: opt.valueText || opt._id || uid(),
      image: opt.image || null,
    }));
    return {
      ...rest,
      questionText: (rest.questionText || "").trim(),
      correctAnswer: (rest.correctAnswer || "").trim(),
      options,
    };
  },

  grade(question, answer) {
    const a = String(answer ?? "").trim();
    const c = String(question.correctAnswer ?? "").trim();
    return { isCorrect: a === c };
  },

  toDocxContent(question, context = {}) {
    const descriptors = [];
    (question.options || []).forEach((opt, index) => {
      descriptors.push(optionDescriptor(index, opt?.optionText || opt?.valueText));
      if (opt?.image?.cloudId) descriptors.push(noteDescriptor("[صورة]"));
    });
    if (context.includeAnswers) {
      descriptors.push(answerDescriptor(resolveCorrectOptionText(question)));
    }
    return compactDescriptors(descriptors);
  },
};

register(plugin);
export default plugin;
