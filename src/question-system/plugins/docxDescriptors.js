// src/question-system/plugins/docxDescriptors.js
//
// Format-neutral descriptor helpers shared by Question plugin `toDocxContent`
// formatters. Plugins MUST NOT import the `docx` package — the repository
// exporter converts these descriptors into actual DOCX elements.

const OPTION_LABELS = ["أ", "ب", "ج", "د", "هـ", "و"];

export function optionDescriptor(index, text) {
  if (!text) return null;
  const label = OPTION_LABELS[index] || String(index + 1);
  return { type: "option", text: `${label}) ${String(text)}` };
}

export function candidateDescriptor(text) {
  return text ? { type: "candidate", text: String(text) } : null;
}

export function answerDescriptor(text) {
  return text ? { type: "answer", text: String(text) } : null;
}

export function noteDescriptor(text) {
  return text ? { type: "note", text: String(text) } : null;
}

export function pairDescriptor(left, right) {
  return {
    type: "pair",
    left: String(left ?? ""),
    right: String(right ?? ""),
  };
}

export function compactDescriptors(list) {
  return (list || []).filter(Boolean);
}

export function resolveCorrectOptionText(question) {
  const correct = question?.correctAnswer;
  if (!correct) return "";
  const match = (question?.options || []).find(
    (opt) => opt?.valueText === correct
  );
  return match?.optionText || String(correct);
}

export function formatTrueFalseAnswer(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return "صح";
  if (normalized === "false") return "خطأ";
  return String(value ?? "").trim();
}
