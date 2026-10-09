import { registerExtractor } from "../../registry";

const extractor = {
  id: "question-bank",
  category: "repository",
  priority: 40,
  implemented: false,
  canHandle(input) {
    return Boolean(input?.questionBankId);
  },
  async extract() {
    const e = new Error("Question Bank extraction is not implemented in Phase C1");
    e.code = "AI_NOT_IMPLEMENTED";
    throw e;
  },
};

registerExtractor(extractor);
export default extractor;