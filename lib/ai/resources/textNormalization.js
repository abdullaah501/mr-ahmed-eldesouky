const ARABIC_TATWEEL = /\u0640/g;
const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const RTL_DIR_MARK = /[\u200E\u200F\u202A-\u202E]/g;
const controlCharsRegex = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const multiBlank = /\n{3,}/g;

export function normalizeText(input) {
  if (input == null) return "";
  let text = typeof input === "string" ? input : String(input);

  text = text.normalize("NFC");
  text = text.replace(ZERO_WIDTH, "");
  text = text.replace(RTL_DIR_MARK, "");
  text = text.replace(controlCharsRegex, "");
  text = text.replace(ARABIC_TATWEEL, "");

  text = text.replace(/\r\n?/g, "\n");
  text = collapseWhitespace(text);
  text = collapseBlankLines(text);

  return text.trim();
}

export function collapseBlankLines(text) {
  return text.replace(multiBlank, "\n\n");
}

export function collapseWhitespace(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/[ \t]+$/gm, "");
}

export function truncate(text, maxChars) {
  const limit = Number(maxChars) || 0;
  if (!limit || typeof text !== "string" || text.length <= limit) return text;
  return text.slice(0, limit);
}