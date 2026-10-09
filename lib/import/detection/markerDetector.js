const MARKERS = {
  "[MCQ]": "multiple-choice",
  "[TF]": "true-false",
  "[ESSAY]": "essay",
  "[FB]": "fill-blank",
  "[MATCH]": "matching",
};

const MARKER_REGEX = /^\[([A-Z]+)\]/i;

export function detectMarker(block) {
  const text = (block.text || "").trim();
  if (!text) return null;

  const match = text.match(MARKER_REGEX);
  if (!match) return null;

  const rawMarker = match[0].toUpperCase();
  const key = Object.keys(MARKERS).find((k) => rawMarker.startsWith(k));

  if (key) {
    return {
      marker: `[${key.replace(/^\[|\]$/g, "")}]`,
      type: MARKERS[key],
    };
  }

  return { marker: rawMarker, type: null };
}
