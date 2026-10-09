import { registerExtractor } from "../../registry";
import { getBuffer, mimeOf, hasExtension, baseDocumentResult } from "../shared";

const extractor = {
  id: "txt",
  category: "documents",
  priority: 50,
  implemented: true,
  canHandle(input) {
    const mime = mimeOf(input);
    if (mime === "text/plain") return true;
    return hasExtension(input, [".txt", ".text"]);
  },
  async extract(input) {
    const buffer = await getBuffer(input);
    const text = buffer ? buffer.toString("utf-8") : String(input.text || "");
    return baseDocumentResult("txt", text, { sourceMime: "text/plain", sourceName: input?.name });
  },
};

registerExtractor(extractor);
export default extractor;