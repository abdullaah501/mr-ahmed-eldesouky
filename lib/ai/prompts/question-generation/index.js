import { registerPrompt } from "../registry";
import { buildQuestionGenerationPrompt } from "./v1";
import "./v2";

const template = {
  task: "question-generation",
  version: "v1",
  render(vars = {}) {
    const text = buildQuestionGenerationPrompt(vars);
    const user = `أَدخل التوجيهات المطلوبة أعلاه وأَنتج DraftQuestion[] (${vars.questionCount || 1} أسئلة).`;
    return { system: text, user };
  },
};

registerPrompt(template);
export default template;
