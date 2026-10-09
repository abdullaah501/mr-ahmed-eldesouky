import { register } from "../registry";

const plugin = {
  type: "essay",
  apiVersion: 1,
  features: ["manual-grading", "attachments"],
  version: 1,
  meta: {
    label: "مقالي",
    icon: "📝",
    description: "Essay question requiring manual grading by the teacher",
    color: "blue",
    hasOptions: false,
    gradeable: false,
  },

  blank() {
    return {
      questionText: "",
      type: "essay",
      image: null,
      correctAnswer: "",
    };
  },

  validate(input) {
    const errors = [];
    if (!input.questionText?.trim()) errors.push("Question text is required");
    return { ok: errors.length === 0, errors };
  },

  normalize(input) {
    const { key, _id, id, hasOptions, options, ...rest } = input;
    return {
      ...rest,
      questionText: (rest.questionText || "").trim(),
      correctAnswer: rest.correctAnswer || "",
    };
  },

  grade() {
    return null;
  },
};

register(plugin);
export default plugin;
