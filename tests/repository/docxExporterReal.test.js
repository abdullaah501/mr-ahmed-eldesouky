import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { exportQuestionsDocx } from "../../lib/repository/exporters/docx";
import { register } from "../../src/question-system/plugins/registry";
import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";
import "../../src/question-system/plugins/essay/core";

// jszip ships as a dependency of the already-installed `docx` package — no
// new package is added for OOXML inspection.
const ARABIC_SAMPLE =
  "يسمى التنمر الإلكتروني نشر تعليقات مسيئة أو التشهير بالآخرين على الإنترنت.";
const ENGLISH_ONLY = "What is 1 + 1?";

const QUESTIONS = [
  {
    _id: "q1",
    type: "multiple-choice",
    questionText: "ما ناتج ١ + ١؟",
    correctAnswer: "b",
    options: [
      { optionText: "واحد", valueText: "a" },
      { optionText: "اثنان", valueText: "b" },
    ],
  },
  {
    _id: "q2",
    type: "true-false",
    questionText: "الأرض كروية",
    correctAnswer: "true",
  },
  {
    _id: "q3",
    type: "fill-blank",
    questionText: "____ = 2",
    correctAnswer: "واحد",
    options: [
      { text: "واحد", isCorrect: true },
      { text: "اثنان", isCorrect: false },
      { text: "ثلاثة", isCorrect: false },
    ],
  },
  {
    _id: "q4",
    type: "matching",
    questionText: "صل",
    config: {
      pairs: [
        { id: "1", leftItem: "واحد", rightItem: "1" },
        { id: "2", leftItem: "اثنان", rightItem: "2" },
      ],
    },
  },
  {
    _id: "q5",
    type: "image-choice",
    questionText: "اختر الشكل",
    correctAnswer: "v1",
    options: [
      { optionText: "شكل 1", valueText: "v1", image: { cloudId: "c1" } },
      { optionText: "شكل 2", valueText: "v2", image: { cloudId: "c2" } },
    ],
  },
  {
    _id: "q6",
    type: "essay",
    questionText: "اشرح",
    correctAnswer: "نموذج الإجابة",
  },
  {
    _id: "q7",
    type: "unknown-type",
    questionText: "سؤال غير معروف",
    correctAnswer: "x",
    image: { cloudId: "c9" },
  },
  {
    _id: "q8",
    type: "multiple-choice",
    questionText: ARABIC_SAMPLE,
    correctAnswer: "b",
    options: [
      { optionText: "واحد", valueText: "a" },
      { optionText: "Two", valueText: "b" },
    ],
  },
  {
    _id: "q9",
    type: "multiple-choice",
    questionText: ENGLISH_ONLY,
    correctAnswer: "b",
    options: [{ optionText: "Two", valueText: "b" }],
  },
];

async function readDocumentXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml").async("string");
}

function findParagraphXml(xml, text) {
  return xml.split("</w:p>").find((block) => block.includes(text)) || "";
}

describe("repository DOCX exporter — real docx package", () => {
  it("generates a valid OOXML (ZIP) buffer for every current type", async () => {
    const buffer = await exportQuestionsDocx(QUESTIONS, {
      includeAnswers: true,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // ZIP local-file signature.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    // Uncompressed zip entry names prove the document part exists.
    expect(buffer.includes(Buffer.from("word/document.xml"))).toBe(true);
    expect(buffer.includes(Buffer.from("[Content_Types].xml"))).toBe(true);
  });

  it("uses horizontal directionality with no vertical text direction", async () => {
    const buffer = await exportQuestionsDocx(QUESTIONS, {
      includeAnswers: true,
    });
    const xml = await readDocumentXml(buffer);

    // No vertical writing mode anywhere (section-level w:textDirection).
    expect(xml).not.toContain("textDirection");

    // Arabic content: horizontal RTL via paragraph w:bidi + run w:rtl.
    expect(xml).toContain(ARABIC_SAMPLE);
    const arabicBlock = findParagraphXml(xml, ARABIC_SAMPLE);
    expect(arabicBlock).toContain("<w:bidi/>");
    expect(arabicBlock).toContain("<w:rtl/>");
    expect(arabicBlock).toContain('<w:jc w:val="right"/>');

    // English-only content stays standard horizontal LTR.
    expect(xml).toContain(ENGLISH_ONLY);
    const englishBlock = findParagraphXml(xml, ENGLISH_ONLY);
    expect(englishBlock).not.toContain("w:bidi");
    expect(englishBlock).not.toContain("w:rtl");
  });

  it("still generates a valid document when a plugin throws", async () => {
    register({
      type: "exploding-real",
      toDocxContent() {
        throw new Error("boom");
      },
    });

    const buffer = await exportQuestionsDocx(
      [{ _id: "e1", type: "exploding-real", questionText: "لا يختفي" }],
      { includeAnswers: false }
    );

    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
