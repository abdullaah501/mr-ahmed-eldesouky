import { register } from "../registry";
import { compactDescriptors, pairDescriptor } from "../docxDescriptors";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function blankPair() {
  return { id: uid(), leftItem: "", rightItem: "" };
}

const plugin = {
  type: "matching",
  apiVersion: 1,
  features: ["shuffle-pairs", "partial-credit"],
  version: 1,
  meta: { hasOptions: true, gradeable: true, label: "توصيل" },

  blank() {
    return {
      questionText: "",
      type: "matching",
      image: null,
      correctAnswer: "",
      config: { pairs: [blankPair(), blankPair(), blankPair()] },
    };
  },

  validate(input) {
    const errors = [];
    if (!input.questionText?.trim()) errors.push("Question text is required");
    const pairs = input.config?.pairs || [];
    if (pairs.length < 2) errors.push("At least two pairs are required");
    else {
      const hasEmpty = pairs.some((p) => !p.leftItem?.trim() || !p.rightItem?.trim());
      if (hasEmpty) errors.push("All fields are required");
    }
    return { ok: errors.length === 0, errors };
  },

  normalize(input) {
    const { key, _id, id, ...rest } = input;
    const pairs = (rest.config?.pairs || []).map((p) => ({
      id: p.id || uid(),
      leftItem: (p.leftItem || "").trim(),
      rightItem: (p.rightItem || "").trim(),
    }));
    return {
      ...rest,
      questionText: (rest.questionText || "").trim(),
      correctAnswer: (rest.correctAnswer && rest.correctAnswer.trim()) || JSON.stringify(pairs.map((p) => [p.leftItem, p.rightItem])),
      config: { pairs },
    };
  },

  grade(question, answer) {
    const correct = question.config?.pairs || [];
    const correctPairs = correct.map((p) => [p.leftItem, p.rightItem].join("|"));
    let userPairs = [];
    try {
      userPairs = JSON.parse(answer || "[]");
    } catch (_) {}
    if (!Array.isArray(userPairs)) return { isCorrect: false };
    const userSet = new Set(userPairs.map((p) => [p[0], p[1]].join("|")));
    const isCorrect =
      userSet.size === correctPairs.length &&
      correctPairs.every((cp) => userSet.has(cp));
    return { isCorrect };
  },

  toDocxContent(question, context = {}) {
    const pairs = question?.config?.pairs || [];
    if (context.includeAnswers) {
      return pairs.map((pair) => pairDescriptor(pair.leftItem, pair.rightItem));
    }
    // Without the answer key only the left column is meaningful.
    return compactDescriptors(
      pairs.map((pair) =>
        pair.leftItem ? { type: "option", text: String(pair.leftItem) } : null
      )
    );
  },
};

register(plugin);
export default plugin;
