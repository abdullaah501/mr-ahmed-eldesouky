import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("AI final import → Question Bank refresh contract", () => {
  const modal = read("src/app/components/Repository/AIGeneratorModal.jsx");
  const client = read(
    "src/app/(dashboard)/dashboard/repository/RepositoryClient.jsx",
  );

  it("the final import handler awaits the real persistence operation first", () => {
    const awaitIdx = modal.indexOf("await workflow.importRepository()");
    expect(awaitIdx).toBeGreaterThan(-1);
    // The invalidation must sit AFTER the persistence resolution — not on a
    // generation/review/modal-display event.
    const invalidateIdx = modal.indexOf("invalidateQueries");
    expect(invalidateIdx).toBeGreaterThan(awaitIdx);
  });

  it("invalidates the exact existing Question Bank query family", () => {
    expect(modal).toContain('queryKey: ["repository"]');
    expect(modal).toContain('queryKey: ["repositoryStats"]');
    // No parallel AI-only cache may exist.
    expect(modal).not.toContain('"aiQuestions"');
    expect(modal).not.toContain('"generatedQuestions"');
    expect(modal).not.toContain('"reviewQuestions"');
  });

  it("refreshes on every resolved import — including zero-import dedup skips", () => {
    // Root cause proven 2026-08-31: the preflight dedupe resolves success
    // with imported: 0 (already_imported) even though an aborted earlier run
    // may have persisted server-side (the import chain never checks the
    // abort signal), so gating on a positive import count left the Question
    // Bank stale. Invalidation must fire for any non-cancelled result.
    expect(modal).toContain("result.cancelled !== true");
    // The defective positive-count gate must be gone.
    expect(modal).not.toContain("Number(report.imported) > 0");
    // Failures throw inside importRepository → the catch path never
    // invalidates.
    const start = modal.indexOf("await workflow.importRepository()");
    const catchIdx = modal.indexOf("} catch (error)", start);
    const successBlock = modal.slice(start, catchIdx);
    // Exactly one logical invalidation pair inside the success block.
    expect((successBlock.match(/invalidateQueries/g) || []).length).toBe(2);
    expect(successBlock).toContain('["repository"]');
    expect(successBlock).toContain('["repositoryStats"]');
  });

  it("the invalidation lives in the modal itself — no callback-chain dependency", () => {
    // The previous callback-based path proved insufficient in real testing:
    // the final boundary must own the refresh directly.
    expect(modal).toContain("useQueryClient");
    expect(modal).toContain("FINAL IMPORT BOUNDARY");
    // The parent no longer feeds a refresh callback into the AI modal.
    const aiModalJsx = client.slice(
      client.indexOf("<AIGeneratorModal"),
      client.indexOf("/>", client.indexOf("<AIGeneratorModal")),
    );
    expect(aiModalJsx).not.toContain("onSuccess");
  });

  it("no reload / no second cache mechanism", () => {
    expect(modal).not.toContain("window.location.reload");
    expect(client).not.toContain("window.location.reload");
  });

  it("the file-import modal keeps its own success handler untouched", () => {
    const importModalJsx = client.slice(
      client.indexOf("<ImportRepositoryModal"),
      client.indexOf("/>", client.indexOf("<ImportRepositoryModal")),
    );
    expect(importModalJsx).toContain("onSuccess={handleImportSuccess}");
  });
});
