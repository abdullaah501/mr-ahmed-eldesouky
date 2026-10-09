import { registerExtractor } from "../../registry";

const extractor = {
  id: "website",
  category: "urls",
  priority: 30,
  implemented: false,
  canHandle(input) {
    const url = typeof input === "string" ? input : input?.url;
    return Boolean(url && /^https?:\/\//i.test(url));
  },
  async extract() {
    const e = new Error("Website extraction is not implemented in Phase C1");
    e.code = "AI_NOT_IMPLEMENTED";
    throw e;
  },
};

registerExtractor(extractor);
export default extractor;