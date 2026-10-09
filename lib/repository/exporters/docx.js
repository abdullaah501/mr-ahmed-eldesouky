import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { docxContent, meta } from "../../../src/question-system/plugins/registry";
import "../../../src/question-system/plugins/multiple-choice/core";
import "../../../src/question-system/plugins/true-false/core";
import "../../../src/question-system/plugins/fill-blank/core";
import "../../../src/question-system/plugins/matching/core";
import "../../../src/question-system/plugins/image-choice/core";
import "../../../src/question-system/plugins/essay/core";

const FONT = "Arial";
const ANSWER_LABEL = "الإجابة الصحيحة:";
const IMAGE_PLACEHOLDER = "[صورة]";

// WordprocessingML directionality is horizontal: paragraph w:bidi + run w:rtl.
// Section-level w:textDirection is deliberately never used because it selects
// a vertical writing mode.
const ARABIC_PATTERN =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const containsArabic = (text) => ARABIC_PATTERN.test(String(text ?? ""));

function createRun(text, options = {}) {
  const rtl = containsArabic(text);
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    ...(rtl ? { rightToLeft: true } : {}),
    ...options,
  });
}

function createParagraph(children, { rtl, ...options } = {}) {
  return new Paragraph({
    ...(rtl
      ? {
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
        }
      : {}),
    children,
    spacing: { after: 120 },
    ...options,
  });
}

function textParagraph(text, options = {}) {
  return createParagraph([createRun(text, options)], {
    rtl: containsArabic(text),
  });
}

function questionHeadingParagraph(index, typeLabel) {
  const suffix = typeLabel ? ` — ${typeLabel}` : "";
  return createParagraph(
    [createRun(`سؤال ${index + 1}${suffix}`, { bold: true })],
    { rtl: true }
  );
}

function noteParagraph(text) {
  return createParagraph([createRun(text, { italics: true })], {
    rtl: containsArabic(text),
  });
}

function answerParagraph(text) {
  return createParagraph(
    [createRun(`${ANSWER_LABEL} `, { bold: true }), createRun(text)],
    { rtl: true }
  );
}

function buildMetadataLine(question) {
  const parts = [];
  if (question?.difficulty) parts.push(`الصعوبة: ${question.difficulty}`);
  if (question?.grade) parts.push(`الصف: ${question.grade}`);
  if (question?.subject) parts.push(`المادة: ${question.subject}`);
  if (Array.isArray(question?.tags) && question.tags.length > 0) {
    parts.push(`الوسوم: ${question.tags.join("، ")}`);
  }
  return parts.join("  |  ");
}

/**
 * Safe fallback: a Question is never dropped because its type formatter is
 * unavailable. Question number/text/image/metadata are always emitted by the
 * exporter; this only adds the gated answer line.
 */
function buildFallbackDescriptors(question, includeAnswers) {
  if (includeAnswers && question?.correctAnswer) {
    return [{ type: "answer", text: String(question.correctAnswer) }];
  }
  return [];
}

function appendDescriptor(children, descriptor, includeAnswers) {
  if (!descriptor || typeof descriptor !== "object") return;
  switch (descriptor.type) {
    case "option":
    case "candidate":
      if (descriptor.text) children.push(textParagraph(descriptor.text));
      break;
    case "answer":
      // Double gate: plugins only emit answers when asked, and the exporter
      // refuses answer descriptors when the flag is off.
      if (includeAnswers && descriptor.text) {
        children.push(answerParagraph(descriptor.text));
      }
      break;
    case "pair":
      if (descriptor.left || descriptor.right) {
        children.push(
          textParagraph(`${descriptor.left ?? ""} ← ${descriptor.right ?? ""}`)
        );
      }
      break;
    case "note":
      if (descriptor.text) children.push(noteParagraph(descriptor.text));
      break;
    default:
      // Unknown descriptor kinds are ignored; the Question itself remains.
      break;
  }
}

/**
 * Converts authoritative Question documents into one DOCX buffer.
 * The exporter owns document structure, RTL/bidi, metadata and descriptor
 * conversion — never Question-type business logic.
 */
export async function exportQuestionsDocx(questions, { includeAnswers = false } = {}) {
  const gatedAnswers = includeAnswers === true;
  const list = Array.isArray(questions) ? questions : [];
  const children = [];

  list.forEach((question, index) => {
    const type = question?.type || "";
    const typeLabel = type ? meta(type)?.label || type : null;

    children.push(questionHeadingParagraph(index, typeLabel));
    children.push(textParagraph(question?.questionText || ""));
    if (question?.image?.cloudId) {
      children.push(noteParagraph(IMAGE_PLACEHOLDER));
    }

    const descriptors = docxContent(type, question, {
      includeAnswers: gatedAnswers,
      index,
    });
    const formatterOutput =
      Array.isArray(descriptors) && descriptors.length > 0
        ? descriptors
        : buildFallbackDescriptors(question, gatedAnswers);

    for (const descriptor of formatterOutput) {
      appendDescriptor(children, descriptor, gatedAnswers);
    }

    const metadataLine = buildMetadataLine(question);
    if (metadataLine) children.push(noteParagraph(metadataLine));

    if (index < list.length - 1) {
      // Plain horizontal spacer — no bidi direction.
      children.push(
        new Paragraph({
          children: [createRun("")],
          spacing: { after: 240 },
        })
      );
    }
  });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT } },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
