export function parseJsonBuffer(buffer) {
  const text = buffer.toString("utf-8");
  return parseJsonString(text);
}

export function parseJsonString(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty JSON input");

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  return extractShape(parsed);
}

function extractShape(parsed) {
  if (Array.isArray(parsed)) {
    return { questions: parsed, rawMetadata: {} };
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.questions)) {
    const { questions, ...rest } = parsed;
    return { questions, rawMetadata: rest };
  }
  throw new Error("JSON must contain a questions array (or be a plain array of question objects)");
}
