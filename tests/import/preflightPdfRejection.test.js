import { describe, it, expect, vi } from "vitest";
import { preFlightStage } from "../../lib/import/stages/preFlightStage";

vi.mock("../../lib/import/shared/hash", () => ({
  sha256: vi.fn(() => "mock-hash"),
}));

vi.mock("../../lib/repository/questionService", () => ({
  isAlreadyImported: vi.fn(async () => false),
}));

vi.mock("../../lib/import/shared/file", () => ({
  getFileBuffer: vi.fn(async () => Buffer.from("mock")),
  DEFAULT_MAX_FILE_SIZE: 50 * 1024 * 1024,
}));

vi.mock("../../lib/import/registry/pluginRegistry", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolvePlugin: vi.fn(actual.resolvePlugin),
    listPlugins: vi.fn(actual.listPlugins),
  };
});

import "../../lib/import/plugins";

function makeContext(filename) {
  return {
    file: { name: filename, type: "application/pdf" },
    fileMetadata: {
      name: filename,
      size: 100,
      mime: "application/pdf",
      extension: filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? null,
    },
    userId: "user-1",
    options: {},
    plugin: null,
    buffer: null,
    importSourceId: null,
    rawQuestions: null,
    rawMetadata: {},
    metadata: {},
    validQuestions: [],
    mappedItems: [],
    stats: {
      parsed: 0,
      normalized: 0,
      validated: 0,
      mapped: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
    },
    timings: {},
    events: [],
    errors: [],
    warnings: [],
  };
}

describe("preFlightStage — PDF rejection (Fail Fast)", () => {
  it("returns PDF_IMPORT_NOT_SUPPORTED for a .pdf file", async () => {
    const ctx = makeContext("questions.pdf");
    const result = await preFlightStage(ctx);
    expect(result.success).toBe(false);
    expect(result.fatal).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("PDF_IMPORT_NOT_SUPPORTED");
    expect(result.errors[0].message).toContain("PDF import has been removed");
    expect(result.errors[0].message).toContain("DOCX or JSON");
    expect(result.errors[0].stage).toBe("preFlight");
    expect(result.errors[0].file.name).toBe("questions.pdf");
    expect(result.errors[0].file.extension).toBe(".pdf");
  });

  it("is case-insensitive: .PDF also rejected", async () => {
    const ctx = makeContext("REPORT.PDF");
    const result = await preFlightStage(ctx);
    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe("PDF_IMPORT_NOT_SUPPORTED");
  });

  it("does not touch the buffer or hash for a .pdf file", async () => {
    const { sha256 } = await import("../../lib/import/shared/hash");
    const { getFileBuffer } = await import("../../lib/import/shared/file");
    const ctx = makeContext("questions.pdf");
    await preFlightStage(ctx);
    expect(sha256).not.toHaveBeenCalled();
    expect(getFileBuffer).not.toHaveBeenCalled();
  });

  it("does not reach resolvePlugin for a .pdf file", async () => {
    const { resolvePlugin, listPlugins } = await import(
      "../../lib/import/registry/pluginRegistry"
    );
    const ctx = makeContext("questions.pdf");
    await preFlightStage(ctx);
    expect(resolvePlugin).not.toHaveBeenCalled();
    expect(listPlugins).not.toHaveBeenCalled();
  });

  it("proceeds normally for non-PDF files (.docx)", async () => {
    const ctx = makeContext("questions.docx");
    const result = await preFlightStage(ctx);
    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);
  });

  it("proceeds normally for .json files", async () => {
    const ctx = makeContext("questions.json");
    const result = await preFlightStage(ctx);
    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);
  });
});
