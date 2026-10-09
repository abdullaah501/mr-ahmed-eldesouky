import { registerSchema, getSchema, listSchemas } from "./registry";
import schema from "../workflows/knowledgeExtraction/schema/structuredContext";
import draftQuestionsSchema from "../workflows/questionGeneration/schema/draftQuestions";

registerSchema(schema);
registerSchema(draftQuestionsSchema);

export { registerSchema, getSchema, listSchemas };
export { assessContextCompleteness, assertStructuredContext, assertStructuredContextShape, collectLowConfidence, SCHEMA_ID, SCHEMA_VERSION } from "../workflows/knowledgeExtraction/schema/structuredContext";
export { assertDraftQuestions, SCHEMA_ID as DRAFT_QUESTIONS_SCHEMA_ID, SCHEMA_VERSION as DRAFT_QUESTIONS_SCHEMA_VERSION } from "../workflows/questionGeneration/schema/draftQuestions";
