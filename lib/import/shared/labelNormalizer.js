const LABEL_MAP = new Map([
  ["a", 1], ["b", 2], ["c", 3], ["d", 4], ["e", 5], ["f", 6],
  ["1", 1], ["2", 2], ["3", 3], ["4", 4], ["5", 5], ["6", 6],
  ["أ", 1], ["ب", 2], ["ج", 3], ["د", 4],
  ["ا", 1],
]);

export function normalizeLabel(label) {
  if (label == null) return null;

  const str = String(label).trim().toLowerCase();

  if (LABEL_MAP.has(str)) return LABEL_MAP.get(str);

  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 99) return num;

  return null;
}

export function ordinalToIndex(ordinal, optionsLength) {
  if (ordinal == null || optionsLength === 0) return -1;
  const idx = ordinal - 1;
  return idx >= 0 && idx < optionsLength ? idx : -1;
}
