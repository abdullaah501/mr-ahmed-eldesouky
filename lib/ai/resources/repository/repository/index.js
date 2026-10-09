import { registerExtractor } from "../../registry";

const extractor = {
  id: "repository",
  category: "repository",
  priority: 40,
  implemented: false,
  canHandle(input) {
    return Boolean(input && (input.repositoryId || input.lessonId || input.questionBankId || input.kind === "repository"));
  },
  async extract() {
    const e = new Error("Repository extraction is not implemented in Phase C1");
    e.code = "AI_NOT_IMPLEMENTED";
    throw e;
  },
};

registerExtractor(extractor);
export default extractor;