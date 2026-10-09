import { describe, it, expect, vi } from "vitest";

import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/essay/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";

// Runtime grade source is the Grade collection â€” unit suites mock it.
vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { name: "دورات أخرى" },
          { name: "الصف الأول الثانوي" },
          { name: "الصف الثاني الثانوي" },
          { name: "الصف الثالث الثانوي" },
        ]),
      }),
    }),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue({}),
}));

describe("Golden Template Round-trip", () => {
  it("JSON round-trip: export → parse → validate → 0 errors", async () => {
    const { exportJsonTemplate } = await import("../../lib/import/template/exporters/json");
    const json = await exportJsonTemplate();
    const { parseJsonString } = await import("../../lib/import/plugins/json/parser");
    const parsed = parseJsonString(json);
    expect(parsed.questions.length).toBeGreaterThan(0);
    const { normalizeImport } = await import("../../lib/import/normalize/normalizeImport");
    const normalized = normalizeImport(parsed.questions);
    const { validate } = await import("../../src/question-system/plugins/registry");
    let errors = [];
    for (const q of normalized.questions) {
      if (!q.type) { errors.push("MISSING_TYPE"); continue; }
      const result = validate(q.type, q);
      if (!result.ok) errors.push(...result.errors.map((e) => `${q.type}: ${e}`));
    }
    expect(errors).toHaveLength(0);
  });

  it("DOCX round-trip: 0 errors + matching, fill-blank, TF, and metadata for ALL types", async () => {
    const { exportDocxTemplate } = await import("../../lib/import/template/exporters/docx");
    const buffer = await exportDocxTemplate();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const { parseWordBuffer } = await import("../../lib/import/plugins/word/parser");
    const parsed = await parseWordBuffer(buffer);
    expect(parsed.questions.length).toBeGreaterThan(0);
    const { normalizeImport } = await import("../../lib/import/normalize/normalizeImport");
    const normalized = normalizeImport(parsed.questions);
    const { validate } = await import("../../src/question-system/plugins/registry");
    let errors = [];
    for (const q of normalized.questions) {
      if (!q.type) { errors.push("MISSING_TYPE"); continue; }
      const result = validate(q.type, q);
      if (!result.ok) errors.push(...result.errors.map((e) => `${q.type}: ${e}`));
    }
    expect(errors).toHaveLength(0);

    const mcq = normalized.questions.find((q) => q.type === "multiple-choice");
    expect(mcq.correctAnswer).toBe("b");
    expect(mcq.difficulty).toBe("easy");
    expect(mcq.subject).toBe("الرياضيات");

    const tf = normalized.questions.find((q) => q.type === "true-false");
    expect(tf.correctAnswer).toBe("صح");
    expect(tf.subject).toBe("الرياضيات");

    const match = normalized.questions.find((q) => q.type === "matching");
    expect(match.config.pairs.length).toBe(4);
    expect(match.questionText).not.toContain("فرنسا");
    expect(match.subject).toBe("الرياضيات");

    const fb = normalized.questions.find((q) => q.type === "fill-blank");
    expect(fb.options.length).toBe(3);
    expect(fb.options.filter((a) => a.isCorrect).length).toBe(1);
    expect(fb.options[0].text).toBe("القاهرة");
    expect(fb.options[0].isCorrect).toBe(true);
    expect(fb.config.answers).toBeUndefined();
    expect(fb.correctAnswer).toBe("القاهرة");
    expect(fb.subject).toBe("الرياضيات");
  });

  it("DOCX fidelity: all 5 types detected, 0 validation errors", async () => {
    const { exportDocxTemplate } = await import("../../lib/import/template/exporters/docx");
    const buffer = await exportDocxTemplate();
    const { parseWordBuffer } = await import("../../lib/import/plugins/word/parser");
    const parsed = await parseWordBuffer(buffer);
    const { createTemplateDefinition } = await import("../../lib/import/template/templateDefinition");
    const expected = (await createTemplateDefinition()).questions.filter((q) => q.type !== "image-choice");
    expect(parsed.questions.length).toBe(expected.length);
    const { validate } = await import("../../src/question-system/plugins/registry");
    const expectedTypes = expected.map((q) => q.type).sort();
    const parsedTypes = parsed.questions.map((q) => q.type).sort();
    expect(parsedTypes).toEqual(expectedTypes);
    let errors = [];
    for (const q of parsed.questions) {
      if (!q.type) { errors.push("MISSING_TYPE"); continue; }
      const result = validate(q.type, q);
      if (!result.ok) errors.push(...result.errors.map((e) => `${q.type}: ${e}`));
    }
    expect(errors).toHaveLength(0);
  });
});
