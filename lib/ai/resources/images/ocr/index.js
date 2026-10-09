import { registerExtractor } from "../../registry";
import { mimeOf, hasExtension } from "../../documents/shared";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];

const extractor = {
  id: "ocr",
  category: "images",
  priority: 30,
  implemented: false,
  canHandle(input) {
    const mime = mimeOf(input);
    if (mime.startsWith("image/")) return true;
    return hasExtension(input, IMAGE_EXTS);
  },
  async extract() {
    throw newError("OCR extraction is not implemented in Phase C1");
  },
};

function newError(message, code) {
  const e = new Error(message);
  e.code = code || "AI_NOT_IMPLEMENTED";
  return e;
}

registerExtractor(extractor);
export default extractor;