import { register } from "../registry";
import {
  answerDescriptor,
  candidateDescriptor,
  compactDescriptors,
} from "../docxDescriptors";

const plugin = {
  type: "fill-blank",
  apiVersion: 1,
  features: ["partial-credit", "case-insensitive"],
  version: 1,
  meta: { hasOptions: true, gradeable: true, label: "أكمل" },

  blank() {
    return {
      questionText: "",
      type: "fill-blank",
      image: null,
      correctAnswer: "",
      options: [],
      config: { caseSensitive: false },
    };
  },

  validate(input) {
    const errors = [];
    if (!input.questionText?.trim()) errors.push("Question text is required");
    if (!input.questionText?.includes("____"))
      errors.push("Text must contain ____ for the blank");

    const candidates = readCandidates(input);
    if (!Array.isArray(input.options) && !Array.isArray(input.config?.answers)) {
      errors.push("options must be an array");
    }
    if (candidates.length < 3) errors.push("Add at least 3 answers");

    const texts = candidates.map((candidate) => String(candidate?.text || "").trim());
    if (texts.some((text) => !text)) errors.push("Each answer must have text");
    if (new Set(texts.filter(Boolean)).size !== texts.filter(Boolean).length) {
      errors.push("Answer texts must not be duplicated");
    }

    const correct = candidates.filter((candidate) => candidate?.isCorrect === true);
    if (correct.length !== 1) errors.push("Exactly one correct answer must be selected");
    if (!input.correctAnswer?.trim()) {
      errors.push("Correct answer is required");
    } else if (correct.length === 1 && input.correctAnswer.trim() !== correct[0].text) {
      errors.push("The correct answer must match the selected answer text");
    }

    return { ok: errors.length === 0, errors };
  },

  normalize(input) {
    const { key, _id, id, ...rest } = input;
    const config = rest.config || {};
    const options = readCandidates(rest);
    const correct = options.find((candidate) => candidate.isCorrect);
    const { answers: _answers, ...behaviorConfig } = config;
    return {
      ...rest,
      questionText: (rest.questionText || "").trim(),
      correctAnswer: correct?.text || rest.correctAnswer || "",
      options,
      config: {
        ...behaviorConfig,
        caseSensitive: !!config.caseSensitive,
      },
    };
  },

  grade(question, answer) {
    const cfg = question.config || {};
    const user = String(answer ?? "").trim();
    const candidates = readCandidates(question);

    const accepted = candidates
      .filter((candidate) => candidate.isCorrect && candidate.text)
      .map((candidate) => candidate.text);

    if (accepted.length === 0 && question.correctAnswer) {
      accepted.push(question.correctAnswer.trim());
    }

    const compare = cfg.caseSensitive ? (s) => s : (s) => s.toLowerCase();
    const userCompare = compare(user);
    const isCorrect = accepted.some((a) => compare(a) === userCompare);

    return { isCorrect };
  },

  toDocxContent(question, context = {}) {
    const candidates = readCandidates(question);
    const descriptors = candidates.map((candidate) =>
      candidateDescriptor(candidate.text)
    );
    if (context.includeAnswers) {
      const correct = candidates.find((candidate) => candidate.isCorrect);
      descriptors.push(
        answerDescriptor(correct?.text || question?.correctAnswer)
      );
    }
    return compactDescriptors(descriptors);
  },
};

export function readCandidates(question) {
  const source = Array.isArray(question?.options) && question.options.length > 0
    ? question.options
    : Array.isArray(question?.config?.answers)
      ? question.config.answers
      : Array.isArray(question?.options)
        ? question.options
        : [];

  if (source.length > 0) {
    return source.map((candidate, index) => ({
      id: candidate?.id || candidate?._id || `answer-${index + 1}`,
      text: String(candidate?.text || "").trim(),
      isCorrect: candidate?.isCorrect === true,
    }));
  }

  if (question?.correctAnswer?.trim()) {
    return [{ id: "answer-1", text: question.correctAnswer.trim(), isCorrect: true }];
  }

  return [];
}

register(plugin);
export default plugin;
