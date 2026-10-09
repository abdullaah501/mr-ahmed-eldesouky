import { registerExtractor } from "../../registry";

const extractor = {
  id: "youtube",
  category: "urls",
  priority: 50,
  implemented: false,
  canHandle(input) {
    const url = typeof input === "string" ? input : input?.url;
    return Boolean(url && /youtube\.com|youtu\.be/i.test(url));
  },
  async extract() {
    const e = new Error("YouTube extraction is not implemented in Phase C1");
    e.code = "AI_NOT_IMPLEMENTED";
    throw e;
  },
};

registerExtractor(extractor);
export default extractor;