import { registerExtractor } from "../../registry";
import { hasExtension, mimeOf } from "../shared";

const extractor = {
  id: "pdf",
  category: "documents",
  priority: 70,
  implemented: false,
  canHandle(input) {
    const mime = mimeOf(input);
    if (mime === "application/pdf") return true;
    return hasExtension(input, [".pdf"]);
  },
  async extract() {
    const err = new Error("PDF extraction is not implemented in Phase C1. Add a pdf extractor plugin + the chosen dependency.");
    err.code = "AI_NOT_IMPLEMENTED";
    throw err;
  },
};

registerExtractor(extractor);
export default extractor;