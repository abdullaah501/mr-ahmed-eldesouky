import { registerExtractor } from "../../registry";
import { getBuffer, mimeOf, hasExtension, baseDocumentResult } from "../shared";

const extractor = {
  id: "markdown",
  category: "documents",
  priority: 60,
  implemented: true,
  canHandle(input) {
    const mime = mimeOf(input);
    if (mime === "text/markdown") return true;
    return hasExtension(input, [".md", ".markdown"]);
  },
  async extract(input) {
    const buffer = await getBuffer(input);
    const text = buffer ? buffer.toString("utf-8") : String(input.text || "");
    return baseDocumentResult("markdown", text, { sourceMime: "text/markdown", sourceName: input?.name });
  },
};

registerExtractor(extractor);
export default extractor;