import { describe, it, expect, vi, beforeEach } from "vitest";

const capture = vi.hoisted(() => ({
  runs: [],
  paragraphs: [],
  documents: [],
  buffer: Buffer.from("PK-fake-docx"),
}));

vi.mock("docx", () => {
  class TextRun {
    constructor(options = {}) {
      capture.runs.push(options);
      this.options = options;
    }
  }
  class Paragraph {
    constructor(options = {}) {
      capture.paragraphs.push(options);
      this.options = options;
    }
  }
  class Document {
    constructor(options = {}) {
      capture.documents.push(options);
      this.options = options;
    }
  }
  return {
    AlignmentType: { RIGHT: "right" },
    TextRun,
    Paragraph,
    Document,
    Packer: { toBuffer: vi.fn(async () => capture.buffer) },
  };
});

import { exportQuestionsDocx } from "../../lib/repository/exporters/docx";
import { register } from "../../src/question-system/plugins/registry";
import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";
import "../../src/question-system/plugins/essay/core";

const MCQ = {
  _id: "q1",
  type: "multiple-choice",
  questionText: "ما ناتج ١ + ١؟",
  correctAnswer: "b",
  options: [
    { optionText: "واحد", valueText: "a" },
    { optionText: "اثنان", valueText: "b" },
  ],
  difficulty: "easy",
  grade: "الصف الأول",
  subject: "الرياضيات",
  tags: ["جمع"],
};

function runTexts() {
  return capture.runs.map((run) => String(run.text ?? ""));
}

function paragraphTexts(paragraph) {
  return (paragraph.children || []).map((child) =>
    String(child?.options?.text ?? "")
  );
}

function findParagraph(text) {
  return capture.paragraphs.find((paragraph) =>
    paragraphTexts(paragraph).includes(text)
  );
}

function findRun(text) {
  return capture.runs.find((run) => String(run.text) === text);
}

beforeEach(() => {
  capture.runs = [];
  capture.paragraphs = [];
  capture.documents = [];
});

describe("repository DOCX exporter", () => {
  it("produces one document and returns the packed buffer", async () => {
    const buffer = await exportQuestionsDocx([MCQ, { ...MCQ, _id: "q2" }], {
      includeAnswers: false,
    });

    expect(buffer).toBe(capture.buffer);
    expect(capture.documents).toHaveLength(1);
  });

  it("emits no section-level vertical text direction", async () => {
    await exportQuestionsDocx([MCQ], { includeAnswers: false });

    const section = capture.documents[0].sections[0];
    expect(section.properties?.page?.textDirection).toBeUndefined();
  });

  it("does not force a global RTL document default", async () => {
    await exportQuestionsDocx([MCQ], { includeAnswers: false });

    const defaultRun = capture.documents[0].styles.default.document.run;
    expect(defaultRun.font).toBe("Arial");
    expect(defaultRun.rightToLeft).toBeUndefined();
  });

  it("applies horizontal RTL to Arabic content at paragraph and run level", async () => {
    await exportQuestionsDocx([MCQ], { includeAnswers: false });

    const paragraph = findParagraph(MCQ.questionText);
    expect(paragraph.bidirectional).toBe(true);
    expect(paragraph.alignment).toBe("right");

    const run = findRun(MCQ.questionText);
    expect(run.rightToLeft).toBe(true);
  });

  it("keeps English-only content horizontal LTR", async () => {
    const english = {
      _id: "en1",
      type: "multiple-choice",
      questionText: "What is 1 + 1?",
      correctAnswer: "b",
      options: [
        { optionText: "One", valueText: "a" },
        { optionText: "Two", valueText: "b" },
      ],
    };

    await exportQuestionsDocx([english], { includeAnswers: false });

    const paragraph = findParagraph("What is 1 + 1?");
    expect(paragraph.bidirectional).toBeUndefined();
    expect(paragraph.alignment).toBeUndefined();

    const run = findRun("What is 1 + 1?");
    expect(run.rightToLeft).toBeUndefined();
  });

  it("keeps mixed Arabic + English content horizontal and bidirectional", async () => {
    const mixed = {
      _id: "mx1",
      type: "multiple-choice",
      questionText: "اشرح معنى Bullying في الإنترنت",
      correctAnswer: "b",
      options: [{ optionText: "Bullying", valueText: "b" }],
    };

    await exportQuestionsDocx([mixed], { includeAnswers: false });

    const paragraph = findParagraph(mixed.questionText);
    expect(paragraph.bidirectional).toBe(true);
    expect(paragraph.alignment).toBe("right");
    expect(findRun(mixed.questionText).rightToLeft).toBe(true);
    expect(
      capture.documents[0].sections[0].properties?.page?.textDirection
    ).toBeUndefined();
  });

  it("gates the answer value run direction by content inside the bidi answer paragraph", async () => {
    const question = {
      _id: "en-answer",
      type: "multiple-choice",
      questionText: "اختر الإجابة",
      correctAnswer: "b",
      options: [{ optionText: "Paris", valueText: "b" }],
    };

    await exportQuestionsDocx([question], { includeAnswers: true });

    const answerParagraph = capture.paragraphs.find((paragraph) =>
      paragraphTexts(paragraph).some((text) =>
        text.includes("الإجابة الصحيحة")
      )
    );
    expect(answerParagraph.bidirectional).toBe(true);
    expect(answerParagraph.alignment).toBe("right");

    const labelRun = findRun("الإجابة الصحيحة: ");
    expect(labelRun.rightToLeft).toBe(true);

    const valueRun = findRun("Paris");
    expect(valueRun.rightToLeft).toBeUndefined();
  });

  it("keeps the inter-question spacer horizontal", async () => {
    await exportQuestionsDocx([MCQ, { ...MCQ, _id: "q2" }], {
      includeAnswers: false,
    });

    const spacer = capture.paragraphs.find(
      (paragraph) => paragraphTexts(paragraph).join("") === ""
    );
    expect(spacer).toBeTruthy();
    expect(spacer.bidirectional).toBeUndefined();
  });

  it("emits the question number, type label, text, options and metadata", async () => {
    await exportQuestionsDocx([MCQ], { includeAnswers: false });
    const texts = runTexts();

    expect(texts).toContain("سؤال 1 — اختيار من متعدد");
    expect(texts).toContain(MCQ.questionText);
    expect(texts).toContain("أ) واحد");
    expect(texts).toContain("ب) اثنان");
    expect(texts.some((t) => t.includes("الصعوبة: easy"))).toBe(true);
    expect(texts.some((t) => t.includes("الصف: الصف الأول"))).toBe(true);
    expect(texts.some((t) => t.includes("الوسوم: جمع"))).toBe(true);
  });

  it("gates correct answers strictly behind includeAnswers", async () => {
    await exportQuestionsDocx([MCQ], { includeAnswers: false });
    expect(runTexts().some((t) => t.includes("الإجابة الصحيحة"))).toBe(false);

    capture.runs = [];
    await exportQuestionsDocx([MCQ], { includeAnswers: true });
    const texts = runTexts();
    expect(texts.some((t) => t.includes("الإجابة الصحيحة"))).toBe(true);
    expect(texts).toContain("اثنان");
  });

  it("emits the image placeholder without embedding binaries", async () => {
    await exportQuestionsDocx(
      [{ ...MCQ, image: { cloudId: "cloud-1" } }],
      { includeAnswers: false }
    );
    expect(runTexts()).toContain("[صورة]");
  });

  it("falls back safely for an unknown question type", async () => {
    const unknown = {
      _id: "u1",
      type: "mystery-type",
      questionText: "سؤال غامض",
      correctAnswer: "42",
    };

    await exportQuestionsDocx([unknown], { includeAnswers: false });
    let texts = runTexts();
    expect(texts).toContain("سؤال 1 — mystery-type");
    expect(texts).toContain("سؤال غامض");
    expect(texts.some((t) => t.includes("الإجابة الصحيحة"))).toBe(false);

    capture.runs = [];
    await exportQuestionsDocx([unknown], { includeAnswers: true });
    texts = runTexts();
    expect(texts).toContain("الإجابة الصحيحة: ");
    expect(texts).toContain("42");
  });

  it("never drops a question when a plugin formatter throws", async () => {
    register({
      type: "exploding-export",
      toDocxContent() {
        throw new Error("boom");
      },
    });

    await exportQuestionsDocx(
      [
        {
          _id: "e1",
          type: "exploding-export",
          questionText: "لا يجب أن يختفي",
        },
      ],
      { includeAnswers: false }
    );

    expect(runTexts()).toContain("لا يجب أن يختفي");
  });

  it("exports essay through the common fallback", async () => {
    const essay = {
      _id: "es1",
      type: "essay",
      questionText: "اشرح",
      correctAnswer: "نموذج الإجابة",
    };

    await exportQuestionsDocx([essay], { includeAnswers: false });
    expect(runTexts().some((t) => t.includes("نموذج الإجابة"))).toBe(false);

    capture.runs = [];
    await exportQuestionsDocx([essay], { includeAnswers: true });
    expect(runTexts()).toContain("نموذج الإجابة");
  });

  it("renders matching pairs only when answers are enabled", async () => {
    const matching = {
      _id: "m1",
      type: "matching",
      questionText: "صل",
      config: {
        pairs: [
          { id: "1", leftItem: "واحد", rightItem: "1" },
          { id: "2", leftItem: "اثنان", rightItem: "2" },
        ],
      },
    };

    await exportQuestionsDocx([matching], { includeAnswers: false });
    let texts = runTexts();
    expect(texts).toContain("واحد");
    expect(texts.some((t) => t.includes("←"))).toBe(false);

    capture.runs = [];
    await exportQuestionsDocx([matching], { includeAnswers: true });
    texts = runTexts();
    expect(texts).toContain("واحد ← 1");
    expect(texts).toContain("اثنان ← 2");
  });
});
