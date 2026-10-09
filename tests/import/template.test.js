import { describe, it, expect, vi } from "vitest";
import { createTemplateDefinition } from "../../lib/import/template/templateDefinition";
import { getExporter, getSupportedFormats } from "../../lib/import/template/registry";

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

describe("templateDefinition", () => {
  it("has all 6 supported question types", async () => {
    const template = await createTemplateDefinition();
    const types = template.questions.map((q) => q.type);
    expect(types).toContain("multiple-choice");
    expect(types).toContain("true-false");
    expect(types).toContain("essay");
    expect(types).toContain("fill-blank");
    expect(types).toContain("matching");
    expect(types).toContain("image-choice");
  });

  it("has no duplicate types", async () => {
    const template = await createTemplateDefinition();
    const types = template.questions.map((q) => q.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("has metadata defaults with required keys", async () => {
    const template = await createTemplateDefinition();
    expect(template.defaults).toBeDefined();
    expect(template.defaults.grade).toBeDefined();
    expect(template.defaults.subject).toBeDefined();
    expect(template.defaults.difficulty).toBeDefined();
    expect(template.defaults.tags).toBeDefined();
  });
});

describe("JSON exporter", () => {
  it("produces valid JSON string", async () => {
    const { exportJsonTemplate } = await import("../../lib/import/template/exporters/json");
    const json = await exportJsonTemplate();
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.questions)).toBe(true);
    expect(parsed.questions.length).toBe(6);
    expect(parsed.defaults).toBeDefined();
  });

  it("roundtrip imports successfully through parser", async () => {
    const { exportJsonTemplate } = await import("../../lib/import/template/exporters/json");
    const json = await exportJsonTemplate();
    const { parseJsonString } = await import("../../lib/import/plugins/json/parser");
    const result = parseJsonString(json);
    expect(result.questions).toHaveLength(6);
    expect(result.rawMetadata.defaults).toBeDefined();
  });
});

describe("DOCX exporter", () => {
  it("DOCX exporter returns non-empty Buffer", async () => {
    const { exportDocxTemplate } = await import("../../lib/import/template/exporters/docx");
    const buffer = await exportDocxTemplate();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});

describe("registry", () => {
  it("resolves json/docx exporters as functions", async () => {
    expect(typeof getExporter("json")).toBe("function");
    expect(typeof getExporter("docx")).toBe("function");
  });

  it("returns null for invalid format", async () => {
    expect(getExporter("xlsx")).toBeNull();
    expect(getExporter(null)).toBeNull();
    expect(getExporter("")).toBeNull();
  });

  it("getSupportedFormats returns json and docx", async () => {
    const formats = getSupportedFormats();
    expect(formats).toContain("json");
    expect(formats).toContain("docx");
    expect(formats.length).toBe(2);
  });
});
