import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { docxContent, listTypes, register } from "../../src/question-system/plugins/registry";
import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";
import "../../src/question-system/plugins/essay/core";

const MCQ = {
  type: "multiple-choice",
  questionText: "اختر",
  correctAnswer: "b",
  options: [
    { optionText: "أول", valueText: "a" },
    { optionText: "ثان", valueText: "b" },
  ],
};

describe("plugin Word formatters", () => {
  it("covers every currently registered type (essay via fallback)", () => {
    const types = listTypes();
    expect(types).toEqual(
      expect.arrayContaining([
        "multiple-choice",
        "true-false",
        "fill-blank",
        "matching",
        "image-choice",
        "essay",
      ])
    );
    for (const type of [
      "multiple-choice",
      "true-false",
      "fill-blank",
      "matching",
      "image-choice",
    ]) {
      const descriptors = docxContent(
        type,
        { type, questionText: "q", options: [], config: {} },
        { includeAnswers: false }
      );
      expect(Array.isArray(descriptors)).toBe(true);
    }
    // Essay intentionally relies on the common fallback.
    expect(
      docxContent("essay", { type: "essay", questionText: "q" }, {})
    ).toBeNull();
  });

  it("multiple-choice emits labeled options and gates the answer", () => {
    const closed = docxContent("multiple-choice", MCQ, { includeAnswers: false });
    expect(closed.map((d) => d.text)).toEqual(["أ) أول", "ب) ثان"]);
    expect(closed.some((d) => d.type === "answer")).toBe(false);

    const open = docxContent("multiple-choice", MCQ, { includeAnswers: true });
    expect(open.at(-1)).toEqual({ type: "answer", text: "ثان" });
  });

  it("true-false uses canonical Arabic candidates and gated answers", () => {
    const closed = docxContent(
      "true-false",
      { type: "true-false", correctAnswer: "true" },
      { includeAnswers: false }
    );
    expect(closed.map((d) => d.text)).toEqual(["صح", "خطأ"]);

    const open = docxContent(
      "true-false",
      { type: "true-false", correctAnswer: "false" },
      { includeAnswers: true }
    );
    expect(open.at(-1)).toEqual({ type: "answer", text: "خطأ" });
  });

  it("fill-blank emits candidates and the gated correct answer", () => {
    const question = {
      type: "fill-blank",
      questionText: "____ = 2",
      correctAnswer: "واحد",
      options: [
        { text: "واحد", isCorrect: true },
        { text: "اثنان", isCorrect: false },
        { text: "ثلاثة", isCorrect: false },
      ],
    };
    const closed = docxContent("fill-blank", question, { includeAnswers: false });
    expect(closed.map((d) => d.type)).toEqual([
      "candidate",
      "candidate",
      "candidate",
    ]);
    expect(closed.some((d) => d.type === "answer")).toBe(false);

    const open = docxContent("fill-blank", question, { includeAnswers: true });
    expect(open.at(-1)).toEqual({ type: "answer", text: "واحد" });
  });

  it("matching never leaks the answer key when answers are disabled", () => {
    const question = {
      type: "matching",
      config: {
        pairs: [
          { id: "1", leftItem: "واحد", rightItem: "1" },
          { id: "2", leftItem: "اثنان", rightItem: "2" },
        ],
      },
    };

    const closed = docxContent("matching", question, { includeAnswers: false });
    expect(closed).toEqual([
      { type: "option", text: "واحد" },
      { type: "option", text: "اثنان" },
    ]);
    expect(JSON.stringify(closed)).not.toContain("rightItem");

    const open = docxContent("matching", question, { includeAnswers: true });
    expect(open).toEqual([
      { type: "pair", left: "واحد", right: "1" },
      { type: "pair", left: "اثنان", right: "2" },
    ]);
  });

  it("image-choice emits option placeholders and the gated answer", () => {
    const question = {
      type: "image-choice",
      correctAnswer: "v2",
      options: [
        { optionText: "شكل 1", valueText: "v1", image: { cloudId: "c1" } },
        { optionText: "شكل 2", valueText: "v2", image: { cloudId: "c2" } },
      ],
    };
    const closed = docxContent("image-choice", question, { includeAnswers: false });
    expect(closed.filter((d) => d.type === "note")).toHaveLength(2);
    expect(closed.every((d) => d.type !== "answer")).toBe(true);

    const open = docxContent("image-choice", question, { includeAnswers: true });
    expect(open.at(-1)).toEqual({ type: "answer", text: "شكل 2" });
  });

  it("returns null for an unknown type", () => {
    expect(docxContent("mystery", { type: "mystery" }, {})).toBeNull();
  });

  it("returns null when a plugin formatter throws", () => {
    register({
      type: "exploding",
      toDocxContent() {
        throw new Error("boom");
      },
    });
    expect(docxContent("exploding", { type: "exploding" }, {})).toBeNull();
  });

  it("keeps the docx package out of plugin formatters", () => {
    const files = [
      "multiple-choice/core.js",
      "true-false/core.js",
      "fill-blank/core.js",
      "matching/core.js",
      "image-choice/core.js",
      "essay/core.js",
    ];
    for (const file of files) {
      const source = readFileSync(
        resolve(process.cwd(), "src/question-system/plugins", file),
        "utf8"
      );
      expect(source).not.toMatch(/from\s+["']docx["']/);
      expect(source).not.toContain('require("docx")');
    }
  });
});
