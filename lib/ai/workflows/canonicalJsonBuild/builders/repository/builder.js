import { buildCanonicalJson, mapDraftQuestionToCanonical } from "../../fieldMapping";

export const repositoryBuilder = {
  id: "repository",
  implemented: true,
  build(draftQuestions, ctx) {
    return buildCanonicalJson(draftQuestions, ctx);
  },
  mapSingle(draft, ctx) {
    return mapDraftQuestionToCanonical(draft, ctx);
  },
};

export default repositoryBuilder;