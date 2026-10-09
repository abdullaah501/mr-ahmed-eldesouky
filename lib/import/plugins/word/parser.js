import { extractWordImages } from "./imageExtractor";
import { detectQuestionType } from "../../detection/detectQuestionType";
import { detectCorrectAnswer } from "../../shared/answerDetector";
import { parseMetadataBlock } from "../../shared/metadataParser";

const MARKER_REGEX = /^\[([A-Z]+)\]/i;

function removeMarker(text) {
  return text.replace(/^\[[A-Z]+\]\s*/i, "").trim();
}

function extractOptions(text) {
  const lines = text.split(/\n/).filter((l) => l.trim());
  const options = [];
  const nonOptionLines = [];
  let optionStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^[A-Da-d\u0623-\u062F][.)\s]/.test(trimmed) || /^\d{1,2}[.)\s]/.test(trimmed)) {
      if (optionStart === 0) optionStart = i;
      const cleaned = trimmed.replace(/^[A-Da-d\u0623-\u062F][.)\s]+/, "").replace(/^\d{1,2}[.)\s]+/, "");
      const latLabel = trimmed.match(/^[A-Da-d]/i)?.[0]?.toLowerCase();
      const arabLabel = trimmed.match(/^[\u0623-\u062F]/)?.[0];
      const label = latLabel || arabLabel || options.length.toString();
      options.push({ optionText: cleaned, valueText: label });
    } else {
      nonOptionLines.push(trimmed);
    }
  }

  if (optionStart > 0 && nonOptionLines.length > 0) {
    const questionText = nonOptionLines.join("\n");
    return { questionText, options };
  }

  return { questionText: text, options };
}

function splitHtmlBlocks(html, imageBuffers) {
  const blocks = [];
  const tagRegex = /<\/?(?:p|h[1-6]|li|td)(?:\s[^>]*)?>/gi;
  const parts = html.replace(/<br\s*\/?>/gi, "\n").split(tagRegex);

  let currentText = "";

  for (const part of parts) {
    let trimmed = part.trim();
    if (!trimmed || /^<\//.test(trimmed) || /^</.test(trimmed)) continue;

    trimmed = trimmed.replace(/\[IMAGE\]/gi, "").trim();
    if (!trimmed) continue;

    currentText += (currentText ? "\n" : "") + trimmed;
  }

  if (currentText.trim()) {
    const text = currentText.trim();
    const markerRegex = /(?=\[(?:MCQ|MATCH|META|TF|ESSAY|FB)\])/gi;
    const markerBlocks = text.split(markerRegex).filter((s) => s.trim());

    for (const rawText of markerBlocks) {
      const blockText = rawText.trim();
      if (!blockText) continue;

      if (/^\[META\]/i.test(blockText)) {
        blocks.push({ text: blockText, images: [] });
        continue;
      }

      const blockImages = [];
      const cleanedText = blockText.replace(/\[IMAGE_(\d+)\]/gi, (match, idx) => {
        const i = parseInt(idx, 10);
        if (i < imageBuffers.length) {
          blockImages.push({ ...imageBuffers[i] });
        }
        return "";
      }).trim();

      blocks.push({ text: cleanedText, images: blockImages });
    }
  }

  return blocks;
}

function mergeBlocks(blocks) {
  const merged = [];
  for (const block of blocks) {
    const text = block.text;
    const hasMarker = MARKER_REGEX.test(text);
    const hasOptions = /^[A-Da-d\u0623-\u062F][.)\s]/m.test(text);
    const isMeta = /^\[META\]/i.test(text);

    if (merged.length === 0 || (hasMarker && !isMeta) || hasOptions) {
      merged.push({ text, images: block.images });
    } else {
      const last = merged[merged.length - 1];
      last.text = last.text + "\n" + text;
      for (const img of block.images) {
        last.images.push(img);
      }
    }
  }
  return merged;
}

function buildQuestion(block, detection) {
  const text = removeMarker(block.text);

  const { cleanedText, metadata } = parseMetadataBlock(text);
  const answerText = cleanedText || text;

  const detected = detectCorrectAnswer({
    text: answerText,
    type: detection.detectedType,
    options: [],
  });

  let questionText;
  let options;
  let correctAnswer;
  let config;

  switch (detection.detectedType) {
    case "multiple-choice": {
      const extracted = extractOptions(detected.cleanedText);
      questionText = extracted.questionText;
      options = extracted.options;
      const ansDetection = detectCorrectAnswer({
        text: detected.cleanedText,
        type: detection.detectedType,
        options,
      });
      correctAnswer = ansDetection.correctAnswer || detected.correctAnswer;
      break;
    }
    case "true-false": {
      questionText = detected.cleanedText;
      correctAnswer = detected.correctAnswer;
      break;
    }
    case "essay": {
      questionText = detected.cleanedText;
      correctAnswer = detected.correctAnswer;
      break;
    }
    case "fill-blank": {
      questionText = detected.cleanedText;
      correctAnswer = detected.correctAnswer;
      options = detected.options || [];
      config = { caseSensitive: false };
      if (correctAnswer && options.length === 0) {
        options = [{ id: "a1", text: correctAnswer, isCorrect: true }];
      }
      break;
    }
    case "matching": {
      questionText = detected.questionText || detected.cleanedText;
      correctAnswer = detected.correctAnswer;
      config = detected.config;
      break;
    }
    default:
      questionText = detected.cleanedText;
      correctAnswer = detected.correctAnswer;
      break;
  }

  const question = {
    type: detection.detectedType,
    questionText,
    correctAnswer,
    options: options || [],
  };

  if (config) question.config = config;

  if (block.images.length > 0) {
    question.image = block.images[0];
  }

  if (metadata.difficulty) question.difficulty = metadata.difficulty;
  if (metadata.grade) question.grade = metadata.grade;
  if (metadata.subject) question.subject = metadata.subject;
  if (metadata.tags) question.tags = metadata.tags;

  return question;
}

export async function parseWordBuffer(buffer) {
  const extractResult = await extractWordImages(buffer);
  const warnings = [...(extractResult.warnings || [])];

  const blocks = splitHtmlBlocks(extractResult.html, extractResult.imageBuffers);
  const merged = mergeBlocks(blocks);

  const questions = [];
  const defaultConfidenceThreshold = 0.80;

  for (let i = 0; i < merged.length; i++) {
    const block = merged[i];
    if (!block.text.trim()) continue;

    const detection = detectQuestionType(block, defaultConfidenceThreshold);

    if (detection.warning) {
      warnings.push({
        code: detection.warning,
        message: detection.warning === "UNKNOWN_MARKER"
          ? `Unknown marker: ${detection.marker}`
          : detection.warning === "LOW_DETECTION_CONFIDENCE"
            ? `Low confidence: ${detection.confidence.toFixed(2)}`
            : detection.warning === "QUESTION_TYPE_UNKNOWN"
              ? "Unknown question type"
              : "Detection conflicts with the marker",
        questionIndex: i,
        stage: "parse",
      });

      if (detection.warning === "CONFLICTING_DETECTION") {
        const question = buildQuestion(block, detection);
        questions.push(question);
      }
      continue;
    }

    if (detection.detectedType === null) {
      warnings.push({
        code: "QUESTION_TYPE_UNKNOWN",
        message: "Unknown question type",
        questionIndex: i,
        stage: "parse",
      });
      continue;
    }

    const question = buildQuestion(block, detection);

    questions.push(question);
  }

  return { questions, rawMetadata: {}, warnings };
}
