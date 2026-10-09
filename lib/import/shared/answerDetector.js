import { normalizeLabel, ordinalToIndex } from "./labelNormalizer";

const ANSWER_MARKERS = [
  "الإجابة الصحيحة", "الجواب الصحيح", "الإجابة", "الجواب",
  "correct answer", "answer", "correct", "ans",
  "صح",
];

const ESSAY_MARKERS = [
  "model answer", "suggested answer",
  "الإجابة النموذجية", "الإجابة المقترحة",
];

const TF_TRUE = new Set(["صح", "true", "yes", "نعم"]);
const TF_FALSE = new Set(["خطأ", "false", "no", "لا"]);

const ALL_MARKERS_REGEX = new Map();

function buildMarkerRegex(marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[:=]\\s*(.+)`, "im");
}

function getMarkerRegex(marker) {
  if (!ALL_MARKERS_REGEX.has(marker)) {
    ALL_MARKERS_REGEX.set(marker, buildMarkerRegex(marker));
  }
  return ALL_MARKERS_REGEX.get(marker);
}

function findAnswerLine(text, markers) {
  for (const marker of markers) {
    const re = getMarkerRegex(marker);
    const match = text.match(re);
    if (match) {
      return { value: match[1].trim(), index: match.index, length: match[0].length };
    }
  }
  return null;
}

function stripAnswerLine(text, index, length) {
  const before = text.slice(0, index).trimEnd();
  const after = text.slice(index + length).trimStart();
  return before ? (before + (after ? "\n" + after : "")) : after;
}

function detectMatchingPairs(text) {
  const lines = text.split(/\n/).filter((l) => l.trim());
  const pairs = [];
  const pairLineIndices = new Set();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^(.+)\s*(?:->|=>|:|-&gt;)\s*(.+)$/);
    if (match) {
      pairs.push({ leftItem: match[1].trim(), rightItem: match[2].trim() });
      pairLineIndices.add(i);
    }
  }

  if (pairs.length >= 2) {
    const questionLines = lines.filter((_, idx) => !pairLineIndices.has(idx));
    return {
      config: { pairs },
      correctAnswer: JSON.stringify(pairs.map((p) => [p.leftItem, p.rightItem])),
      questionText: questionLines.join("\n").trim(),
    };
  }

  return null;
}

export function detectCorrectAnswer({ text, type, options = [] }) {
  let result;

  switch (type) {
    case "multiple-choice": {
      const found = findAnswerLine(text, ANSWER_MARKERS);
      if (!found) return { correctAnswer: "", cleanedText: text };

      const idx = ordinalToIndex(normalizeLabel(found.value), options.length);
      if (idx >= 0 && options[idx]) {
        result = { correctAnswer: options[idx].valueText, cleanedText: stripAnswerLine(text, found.index, found.length) };
      } else {
        result = { correctAnswer: found.value, cleanedText: stripAnswerLine(text, found.index, found.length) };
      }
      break;
    }

    case "true-false": {
      const found = findAnswerLine(text, ANSWER_MARKERS);
      if (!found) return { correctAnswer: "", cleanedText: text };

      const lower = found.value.toLowerCase();
      if (TF_TRUE.has(lower)) {
        result = { correctAnswer: "صح", cleanedText: stripAnswerLine(text, found.index, found.length) };
      } else if (TF_FALSE.has(lower)) {
        result = { correctAnswer: "خطأ", cleanedText: stripAnswerLine(text, found.index, found.length) };
      } else {
        result = { correctAnswer: lower, cleanedText: stripAnswerLine(text, found.index, found.length) };
      }
      break;
    }

    case "essay": {
      const found = findAnswerLine(text, [...ESSAY_MARKERS, ...ANSWER_MARKERS]);
      if (!found) return { correctAnswer: "", cleanedText: text };
      result = { correctAnswer: found.value, cleanedText: stripAnswerLine(text, found.index, found.length) };
      break;
    }

    case "fill-blank": {
      const CHECKBOX_REGEX = /^\[([x✓✔✅ \t])\]\s*(.*)$/i;

      // ── New checkbox format: [x] / [✓] / [ ] ────────────────
      const lines = text.split(/\n/);
      const checkboxAnswers = [];
      let firstCheckboxIdx = -1;
      let foundCorrect = false;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const match = trimmed.match(CHECKBOX_REGEX);
        if (match) {
          const marker = match[1].trim();
          const isMarked = /^[x✓✔✅]/i.test(marker);
          const answerText = match[2].trim();
          const isCorrect = isMarked && !foundCorrect;
          if (isCorrect) foundCorrect = true;
          checkboxAnswers.push({ text: answerText, isCorrect });
          if (firstCheckboxIdx < 0) firstCheckboxIdx = i;
        }
      }

      if (checkboxAnswers.length >= 1) {
        const cleanedText = firstCheckboxIdx > 0
          ? lines.slice(0, firstCheckboxIdx).join("\n").trim()
          : text;
        return {
          correctAnswer: checkboxAnswers.find((a) => a.isCorrect)?.text || "",
          cleanedText,
          options: checkboxAnswers,
        };
      }

      // ── Legacy fallback: الإجابة الصحيحة: + bullets ────────
      const found = findAnswerLine(text, ANSWER_MARKERS);
      if (!found) return { correctAnswer: "", cleanedText: text };

      const afterAnswer = text.slice(found.index + found.length);
      const afterLines = afterAnswer.split(/\n/);
      const bullets = [];
      let nonBulletStart = -1;

      for (let i = 0; i < afterLines.length; i++) {
        const trimmed = afterLines[i].trim();
        if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
          bullets.push(trimmed.replace(/^[-•]\s*/, "").trim());
        } else if (bullets.length > 0 && trimmed) {
          nonBulletStart = i;
          break;
        }
      }

      if (bullets.length >= 1) {
        const beforeMarker = text.slice(0, found.index).trimEnd();
        const afterBullets = nonBulletStart >= 0
          ? afterLines.slice(nonBulletStart).join("\n").trim()
          : "";
        const cleanedText = beforeMarker
          ? (beforeMarker + (afterBullets ? "\n" + afterBullets : ""))
          : (afterBullets || "");
        return {
          correctAnswer: bullets[0],
          cleanedText: cleanedText || text,
          options: bullets.map((text, index) => ({
            text,
            isCorrect: index === 0,
          })),
        };
      }

      const value = found.value.trim();
      if (value) {
        result = { correctAnswer: value, cleanedText: stripAnswerLine(text, found.index, found.length) };
      } else {
        result = { correctAnswer: "", cleanedText: text };
      }
      break;
    }

    case "matching": {
      const pairs = detectMatchingPairs(text);
      if (pairs) {
        return {
          correctAnswer: pairs.correctAnswer,
          cleanedText: text,
          config: pairs.config,
          questionText: pairs.questionText,
        };
      }
      const found = findAnswerLine(text, ANSWER_MARKERS);
      result = found
        ? { correctAnswer: found.value, cleanedText: stripAnswerLine(text, found.index, found.length) }
        : { correctAnswer: "", cleanedText: text };
      break;
    }

    default:
      result = { correctAnswer: "", cleanedText: text };
      break;
  }

  return result;
}
