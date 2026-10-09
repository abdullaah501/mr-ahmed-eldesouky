import { registerExtractor } from "../../registry";

const extractor = {
  id: "google-docs",
  category: "urls",
  priority: 40,
  implemented: false,
  canHandle(input) {
    const url = typeof input === "string" ? input : input?.url;
    return Boolean(url && /docs\.google\.com/i.test(url));
  },
  async extract() {
    const e = new Error("Google Docs extraction is not implemented in Phase C1");
    e.code = "AI_NOT_IMPLEMENTED";
    throw e;
  },
};

registerExtractor(extractor);
export default extractor;