import { registerExtractor } from "../../registry";
import { AiError, AiErrorCode } from "../../../types/errors";
import { getBuffer, mimeOf, hasExtension, baseDocumentResult } from "../shared";

async function toText(buffer) {
  let mammoth;
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new Error("mammoth is not installed");
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

const extractor = {
  id: "docx",
  category: "documents",
  priority: 80,
  implemented: true,
  canHandle(input) {
    const mime = mimeOf(input);
    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/msword"
    ) return true;
    return hasExtension(input, [".docx", ".doc"]);
  },
  async extract(input) {
    if (hasExtension(input, [".doc"]) && !hasExtension(input, [".docx"])) {
      throw new AiError(
        AiErrorCode.NOT_IMPLEMENTED,
        "Legacy Word documents (.doc) are not supported. Please export as .docx."
      );
    }
    const buffer = await getBuffer(input);
    if (!buffer) throw new Error("DOCX extractor requires a buffer");
    const text = await toText(buffer);
    return baseDocumentResult("docx", text, {
      sourceMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceName: input?.name,
    });
  },
};

registerExtractor(extractor);
export default extractor;
