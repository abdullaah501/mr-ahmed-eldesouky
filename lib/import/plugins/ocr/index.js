import { registerImportPlugin } from "../../registry/pluginRegistry";

registerImportPlugin({
  version: 1,
  capabilities: {},
  implemented: false,
  id: "ocr",
  label: "OCR",
  extensions: [".png", ".jpg", ".jpeg", ".webp", ".bmp"],
  mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/bmp"],
  priority: 70,

  canImport(file) {
    const name = file && typeof file.name === "string" ? file.name.toLowerCase() : "";
    const imageExts = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
    return imageExts.some((ext) => name.endsWith(ext));
  },

  async parse() {
    throw new Error("ocr import not implemented");
  },
});
