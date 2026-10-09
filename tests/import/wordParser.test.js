import { describe, it, expect } from "vitest";
import { parseWordBuffer } from "../../lib/import/plugins/word/parser";
import { ImageRun, Document, Packer, Paragraph, TextRun } from "docx";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8BQDwAEgAF/KFqHsQAAAABJRU5ErkJggg==",
  "base64",
);

async function buildDocx(children) {
  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

function p(text) {
  return new Paragraph({ children: [new TextRun({ text })] });
}

function img() {
  return new Paragraph({
    children: [new ImageRun({ data: tinyPng, transformation: { width: 50, height: 50 } })],
  });
}

describe("Word parser regression", () => {
  it("returns empty array for empty mammoth output", async () => {
    await expect(parseWordBuffer(Buffer.from(""))).rejects.toThrow();
  });

  it("rejects invalid non-docx content", async () => {
    await expect(parseWordBuffer(Buffer.from("[MCQ]\nWhat is 2+2?\nA) 3\nB) 4\nAnswer: B"))).rejects.toThrow();
  });
});

describe("Word parser image placeholder", () => {
  it("embedded image without [IMAGE] text auto-associates with question", async () => {
    const buffer = await buildDocx([
      p("[MCQ]"),
      p("What is this?"),
      img(),
      p("a) cat"),
      p("b) dog"),
      p("c) bird"),
      p("d) fish"),
      p("الإجابة الصحيحة: b"),
    ]);

    const result = await parseWordBuffer(buffer);
    expect(result.questions.length).toBe(1);
    const q = result.questions[0];
    expect(q.type).toBe("multiple-choice");
    expect(q.questionText).not.toContain("[IMAGE]");
    expect(q.questionText).not.toMatch(/\[IMAGE_\d+\]/);
    expect(q.image).toBeDefined();
    expect(Buffer.isBuffer(q.image.buffer)).toBe(true);
    expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  it("two embedded images with one [IMAGE] text: first image associated, second discarded", async () => {
    const buffer = await buildDocx([
      p("[MCQ]"),
      p("Question text"),
      p("[IMAGE]"),
      img(),
      img(),
      p("a) opt1"),
      p("b) opt2"),
      p("الإجابة الصحيحة: a"),
    ]);

    const result = await parseWordBuffer(buffer);
    expect(result.questions.length).toBe(1);
    const q = result.questions[0];
    expect(q.type).toBe("multiple-choice");
    expect(q.questionText).not.toContain("[IMAGE]");
    expect(q.questionText).not.toMatch(/\[IMAGE_\d+\]/);
    expect(q.image).toBeDefined();
    expect(Buffer.isBuffer(q.image.buffer)).toBe(true);
  });

  it("[IMAGE] inside META is NOT treated as an image marker", async () => {
    const buffer = await buildDocx([
      p("[MCQ]"),
      p("Question with meta"),
      img(),
      p("a) opt1"),
      p("b) opt2"),
      p("الإجابة الصحيحة: a"),
      p("[META]"),
      p("Difficulty: easy"),
      p("[IMAGE]"),
      p("Subject: الرياضيات"),
    ]);

    const result = await parseWordBuffer(buffer);
    expect(result.questions.length).toBe(1);
    const q = result.questions[0];
    expect(q.type).toBe("multiple-choice");
    expect(q.questionText).not.toMatch(/\[IMAGE_\d+\]/);
    expect(q.questionText).not.toContain("[IMAGE]");
    // The actual embedded image (before options) should be associated
    expect(q.image).toBeDefined();
    expect(Buffer.isBuffer(q.image.buffer)).toBe(true);
    // [IMAGE] in META was stripped — should not pollute question or metadata
    expect(q.questionText).not.toContain("[IMAGE]");
    expect(q.difficulty).toBe("easy");
    expect(q.subject).toBe("الرياضيات");
  });
});
