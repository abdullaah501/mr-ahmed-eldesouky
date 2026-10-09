import { describe, it, expect } from "vitest";
import { parseMetadataBlock } from "../../lib/import/shared/metadataParser";

describe("metadataParser", () => {
  it("parses English [META] block", () => {
    const result = parseMetadataBlock(
      "[META]\nDifficulty: easy\nGrade: 10\nSubject: Physics\nTags: electricity, circuits\n\nWhat is Ohm's law?"
    );
    expect(result.metadata).toEqual({
      difficulty: "easy",
      grade: "10",
      subject: "Physics",
      tags: ["electricity", "circuits"],
    });
  });

  it("parses Arabic [META] block", () => {
    const result = parseMetadataBlock(
      "[META]\nالصعوبة: صعب\nالصف: الثالث الثانوي\nالمادة: الفيزياء\nالوسوم: كهرباء, مراجعة\n\nالسؤال"
    );
    expect(result.metadata).toEqual({
      difficulty: "hard",
      grade: "الثالث الثانوي",
      subject: "الفيزياء",
      tags: ["كهرباء", "مراجعة"],
    });
  });

  it("strips metadata block from text", () => {
    const result = parseMetadataBlock(
      "[META]\nDifficulty: medium\nGrade: 9\n\nWhat is gravity?"
    );
    expect(result.cleanedText).toBe("What is gravity?");
  });

  it("maps Arabic difficulty values", () => {
    expect(parseMetadataBlock("[META]\nالصعوبة: سهل").metadata.difficulty).toBe("easy");
    expect(parseMetadataBlock("[META]\nالصعوبة: متوسط").metadata.difficulty).toBe("medium");
    expect(parseMetadataBlock("[META]\nالصعوبة: صعب").metadata.difficulty).toBe("hard");
  });

  it("returns empty metadata for text without [META]", () => {
    const result = parseMetadataBlock("Plain question text");
    expect(result.metadata).toEqual({});
    expect(result.cleanedText).toBe("Plain question text");
  });

  it("ignores unsupported metadata keys", () => {
    const result = parseMetadataBlock(
      "[META]\nUnsupportedKey: value\nDifficulty: easy"
    );
    expect(result.metadata).toEqual({ difficulty: "easy" });
  });
});
