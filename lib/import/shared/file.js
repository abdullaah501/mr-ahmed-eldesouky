export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function getFileBuffer(file) {
  if (Buffer.isBuffer(file)) return file;

  if (typeof file === "string") {
    return Buffer.from(file, "utf-8");
  }

  if (file instanceof ArrayBuffer || file instanceof Uint8Array) {
    return Buffer.from(file);
  }

  if (file && typeof file.arrayBuffer === "function") {
    const ab = await file.arrayBuffer();
    return Buffer.from(ab);
  }

  if (file && typeof file.text === "function") {
    const text = await file.text();
    return Buffer.from(text, "utf-8");
  }

  throw new Error("Unsupported file type");
}

export function getFileExtension(file) {
  if (file && typeof file.name === "string") {
    const idx = file.name.lastIndexOf(".");
    if (idx > 0) return file.name.slice(idx).toLowerCase();
  }
  return null;
}

export function getFileMimeType(file) {
  if (file && typeof file.type === "string" && file.type) {
    return file.type.toLowerCase();
  }
  return null;
}

export function getFileName(file) {
  if (file && typeof file.name === "string") return file.name;
  if (Buffer.isBuffer(file)) return "buffer";
  if (file instanceof ArrayBuffer || file instanceof Uint8Array) return "arraybuffer";
  if (typeof file === "string") return "inline";
  return "unknown";
}

export function getFileSize(file) {
  if (file && typeof file.size === "number") return file.size;
  if (Buffer.isBuffer(file)) return file.length;
  if (typeof file === "string") return Buffer.byteLength(file, "utf-8");
  if (file instanceof ArrayBuffer || file instanceof Uint8Array) return file.byteLength;
  return 0;
}
