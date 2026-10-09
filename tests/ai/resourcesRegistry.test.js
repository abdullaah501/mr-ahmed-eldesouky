import { describe, it, expect } from "vitest";
import { registerExtractor, clearExtractors, resolveExtractor, listByCategory, listExtractors } from "../../lib/ai/resources/registry";
import "../../lib/ai/resources/bootstrap";

describe("resources registry", () => {
  it("resolves txt extractor by mime/text", () => {
    const ext = resolveExtractor({ mimetype: "text/plain", buffer: Buffer.from("hello") });
    expect(ext?.id).toBe("txt");
  });

  it("resolves txt extractor by extension", () => {
    const ext = resolveExtractor({ name: "file.txt", buffer: Buffer.from("hello") });
    expect(ext?.id).toBe("txt");
  });

  it("resolves markdown extractor", () => {
    const ext = resolveExtractor({ name: "notes.md", buffer: Buffer.from("# h") });
    expect(ext?.id).toBe("markdown");
  });

  it("resolves docx extractor", () => {
    const ext = resolveExtractor({
      name: "doc.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from([]),
    });
    expect(ext?.id).toBe("docx");
  });

  it("lists document category", () => {
    const docs = listByCategory("documents");
    expect(docs.map((d) => d.id)).toEqual(expect.arrayContaining(["txt", "markdown", "docx", "pdf"]));
  });

  it("skips not-implemented extractors in resolution", () => {
    const ext = resolveExtractor({ name: "doc.pdf", mimetype: "application/pdf", buffer: Buffer.from([]) });
    expect(ext).toBeNull();
  });

  it("url extractor canHandle recognizes url strings (stub skipped in resolution)", () => {
    const website = listExtractors().find((e) => e.id === "website");
    expect(website).toBeTruthy();
    expect(website.canHandle("https://example.com/page")).toBe(true);
    expect(website.implemented).toBe(false);
    expect(resolveExtractor("https://example.com/page")).toBeNull();
  });

  it("rejects unknown inputs", () => {
    expect(resolveExtractor({ name: "thing.xyz" })).toBeNull();
  });
});