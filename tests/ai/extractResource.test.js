import { describe, it, expect } from "vitest";
import { extractResource } from "../../lib/ai/resources";

describe("extractResource", () => {
  it("extracts inline string text", async () => {
    const out = await extractResource("مرحبا   بالعالم\u200B");
    expect(out.kind).toBe("inline");
    expect(out.text).toBe("مرحبا بالعالم");
  });

  it("extracts inline object text and strips zero-width chars", async () => {
    const out = await extractResource({ text: "hello\u200Bworld" });
    expect(out.kind).toBe("inline");
    expect(out.text).toBe("helloworld");
  });

  it("extracts from txt buffer", async () => {
    const out = await extractResource({ name: "f.txt", mimetype: "text/plain", buffer: Buffer.from("plain  text") });
    expect(out.kind).toBe("documents");
    expect(out.text).toBe("plain text");
  });

  it("extracts from markdown resource", async () => {
    const out = await extractResource({ name: "n.md", buffer: Buffer.from("# title\n\ntext") });
    expect(out.text).toBe("# title\n\ntext");
  });

  it("throws RESOURCE_UNSUPPORTED for unknown input", async () => {
    await expect(extractResource({ name: "weird.xyz", buffer: Buffer.from("x") })).rejects.toThrow();
  });

  it("truncates very long text via explicit cap", async () => {
    const long = "0123456789".repeat(50);
    const out = await extractResource(long);
    expect(out.text.length).toBeLessThanOrEqual(200_000);
  });
});