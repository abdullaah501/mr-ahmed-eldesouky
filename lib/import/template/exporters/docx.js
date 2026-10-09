import { createTemplateDefinition } from "../templateDefinition.js";
import { Paragraph, TextRun, Document, Packer } from "docx";

const MARKERS = {
  "multiple-choice": "[MCQ]",
  "true-false": "[TF]",
  "essay": "[Essay]",
  "fill-blank": "[FB]",
  "matching": "[Match]",
};

function createParagraph(text = "") {
  return new Paragraph({
    children: [new TextRun({ text, font: "Arial" })],
  });
}

export async function exportDocxTemplate() {
  const template = await createTemplateDefinition();
  const { questions, defaults } = template;

  const questionsOnly = questions.filter((q) => q.type !== "image-choice");
  const lines = [];

  lines.push("[META]");
  if (defaults.difficulty) lines.push(`Difficulty: ${defaults.difficulty}`);
  if (defaults.grade) lines.push(`Grade: ${defaults.grade}`);
  if (defaults.subject) lines.push(`Subject: ${defaults.subject}`);
  if (defaults.tags?.length) {
    lines.push("Tags:");
    for (const t of defaults.tags) lines.push(`- ${t}`);
  }
  lines.push("");

  for (const q of questionsOnly) {
    const marker = MARKERS[q.type] || `[${q.type.toUpperCase()}]`;

    lines.push(marker);
    lines.push(q.questionText);

    if (q.image != null) {
      lines.push("[IMAGE]");
    }

    if (q.type !== "fill-blank" && q.options && q.options.length > 0) {
      const labels = ["أ", "ب", "ج", "د", "هـ", "و"];
      for (let j = 0; j < q.options.length; j++) {
        lines.push(`${labels[j] || String(j + 1)}) ${q.options[j].optionText}`);
      }
    }

    if (q.correctAnswer) {
      if (q.type === "fill-blank" && q.options?.length >= 1) {
        for (const a of q.options) {
          lines.push(`${a.isCorrect ? "[x]" : "[ ]"} ${a.text}`);
        }
      } else {
        lines.push(`الإجابة الصحيحة: ${q.correctAnswer}`);
      }
    }

    if (q.config?.pairs) {
      lines.push("");
      for (const p of q.config.pairs) {
        lines.push(`${p.leftItem} -> ${p.rightItem}`);
      }
    }

    if (q.explanation) {
      lines.push(`شرح: ${q.explanation}`);
    }

    const metaKeys = [];
    if (q.difficulty) metaKeys.push(`Difficulty: ${q.difficulty}`);
    if (q.grade) metaKeys.push(`Grade: ${q.grade}`);
    if (q.subject) metaKeys.push(`Subject: ${q.subject}`);
    if (q.estimatedTime) metaKeys.push(`Time: ${q.estimatedTime}s`);
    if (q.tags?.length || metaKeys.length > 0) {
      lines.push("[META]");
      for (const mk of metaKeys) lines.push(mk);
      if (q.tags?.length) {
        lines.push("Tags:");
        for (const t of q.tags) lines.push(`- ${t}`);
      }
    }

    lines.push("");

    if (q.type !== "matching") {
      lines.push("");
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: lines.map(createParagraph),
    }],
  });

  return Packer.toBuffer(doc);
}
