import { blank, validate, normalize, grade, get } from "./plugins/registry";

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneQuestion(q) {
  return JSON.parse(JSON.stringify(q));
}

export const QuestionEngine = {
  blank,

  createBlank(type) {
    const q = blank(type);
    if (!q) throw new Error(`Unknown question type: ${type}`);
    return { ...q, id: newId() };
  },

  duplicate(question) {
    const copy = cloneQuestion(question);
    delete copy._id;
    copy.id = newId();
    return copy;
  },

  changeType(question, newType) {
    const plugin = get(newType);
    if (!plugin) throw new Error(`Unknown question type: ${newType}`);

    const fresh = plugin.blank();
    const common = cloneQuestion(question);

    return {
      ...fresh,
      id: common.id || newId(),
      _id: common._id,
      questionText: common.questionText || "",
      image: common.image || null,
      correctAnswer: fresh.correctAnswer || "",
      options: fresh.options || [],
    };
  },

  validate(question) {
    return validate(question.type, question);
  },

  normalize(question) {
    return normalize(question.type, question);
  },

  grade(question, answer) {
    return grade(question.type, question, answer);
  },

  /**
   * Merge two question objects — source fields into target, preserving id.
   * Type-specific fields from source overwrite target.
   */
  merge(target, source) {
    const type = source.type || target.type;
    const plugin = get(type);
    const merged = {
      ...target,
      ...source,
      id: target.id || source.id,
      type,
    };
    if (plugin?.normalize) {
      return plugin.normalize(merged);
    }
    return merged;
  },
};
