export async function getBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input?.buffer && Buffer.isBuffer(input.buffer)) return input.buffer;
  if (input?.bytes && Buffer.isBuffer(input.bytes)) return input.bytes;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input?.arrayBuffer === "function") return Buffer.from(await input.arrayBuffer());
  return null;
}

export function fileName(input) {
  if (!input) return "";
  return (input.name || input.fileName || input.filename || "").toString();
}

export function mimeOf(input) {
  if (!input) return "";
  return (input.mimetype || input.mimeType || input.type || "").toString().toLowerCase();
}

export function hasExtension(input, exts) {
  const name = (fileName(input) || "").toLowerCase();
  return exts.some((e) => name.endsWith(e));
}

export function baseDocumentResult(extractorId, text, extra = {}) {
  return {
    text,
    metadata: { resourceKind: "document", extractorId, ...extra },
    refs: [],
    warnings: [],
  };
}
