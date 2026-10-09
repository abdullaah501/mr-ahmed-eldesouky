function heuristicMCQ(text) {
  const lines = text.split(/\n/).filter(Boolean);
  if (lines.length < 3) return null;

  let optionCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[A-Da-d][.)\s]/.test(trimmed)) optionCount++;
    else if (/^\d{1,2}[.)\s]/.test(trimmed)) optionCount++;
  }

  if (optionCount >= 2 && optionCount <= 6) {
    const ratio = optionCount / (lines.length - 1);
    if (ratio >= 0.5) return { type: "multiple-choice", confidence: Math.min(0.95, 0.75 + ratio * 0.2) };
  }

  return null;
}

function heuristicTrueFalse(text) {
  const lower = text.toLowerCase();
  const hasTrue = /^true\s*$/im.test(lower) || /true\s*$/im.test(lower);
  const hasFalse = /^false\s*$/im.test(lower) || /false\s*$/im.test(lower);
  const hasSah = /^صح\s*$/im.test(text) || /صح\s*$/im.test(text);
  const hasKhata = /^خطأ\s*$/im.test(text) || /خطأ\s*$/im.test(text);

  if ((hasTrue && hasFalse) || (hasSah && hasKhata)) {
    return { type: "true-false", confidence: 0.90 };
  }

  return null;
}

function heuristicFillBlank(text) {
  if (/_{3,}/.test(text) || /\.{3,}/.test(text) || /\[blank\]/i.test(text)) {
    return { type: "fill-blank", confidence: 0.88 };
  }
  return null;
}

function heuristicMatching(text) {
  const lines = text.split(/\n/).filter(Boolean);
  let pairCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+\s*[-–:→]\s*[A-Da-d]/.test(trimmed)) pairCount++;
    else if (/^\w+\s*[-–:→]\s*\w+/i.test(trimmed) && !/^[A-Da-d][.)\s]/.test(trimmed)) pairCount++;
    else if (trimmed.match(/[A-Da-d]\s*[-–:→]/) && trimmed.split(/[-–:→]/).length >= 2) pairCount++;
  }

  if (pairCount >= 2 && pairCount <= 10) {
    return { type: "matching", confidence: Math.min(0.92, 0.75 + pairCount * 0.04) };
  }

  return null;
}

function heuristicEssay(text) {
  const lines = text.split(/\n/).filter(Boolean);
  if (lines.length === 1 && text.length > 80) {
    return { type: "essay", confidence: 0.80 };
  }
  if (lines.length >= 2 && !text.match(/^[A-Da-d][.)\s]/m) && !/_{3,}/.test(text)) {
    const trimmed = text.trim();
    const hasQuestionMark = /[؟?]/.test(trimmed);
    const startsWithExplain = /^(شرح|اذكر|علل|قارن|ناقش|ما|كيف|لماذا|describe|explain|compare|what|how|why)/i.test(trimmed);
    if (hasQuestionMark || startsWithExplain) {
      return { type: "essay", confidence: 0.82 };
    }
    if (trimmed.length > 100) {
      return { type: "essay", confidence: 0.80 };
    }
  }
  return null;
}

const HEURISTICS = [heuristicMCQ, heuristicTrueFalse, heuristicFillBlank, heuristicMatching, heuristicEssay];

export function detectHeuristic(block) {
  let best = null;

  for (const fn of HEURISTICS) {
    const result = fn(block.text);
    if (result && (!best || result.confidence > best.confidence)) {
      best = result;
    }
  }

  return best;
}
