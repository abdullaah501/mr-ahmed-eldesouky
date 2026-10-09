export function normalizeImport(rawQuestions) {
  if (!Array.isArray(rawQuestions)) {
    throw new Error("Expected a questions array, got " + typeof rawQuestions);
  }

  const warnings = [];
  const questions = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    if (!q || typeof q !== "object") {
      warnings.push({ code: "invalid_item", message: `Record #${i + 1} is not a valid object`, itemIndex: i });
      continue;
    }
    questions.push({ ...q });
  }

  return { questions, warnings };
}
