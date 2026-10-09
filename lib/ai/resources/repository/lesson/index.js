import { registerExtractor } from "../../registry";

const extractor = {
  id: "lesson",
  category: "repository",
  priority: 40,
  implemented: false,
  canHandle(input) {
    return Boolean(input?.lessonId);
  },
  async extract() {
    const e = new Error("Lesson extraction is not implemented in Phase C1");
    e.code = "AI_NOT_IMPLEMENTED";
    throw e;
  },
};

registerExtractor(extractor);
export default extractor;