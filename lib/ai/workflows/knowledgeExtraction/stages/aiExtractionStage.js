import { renderPrompt } from "../../../prompts/PromptManager";
import { getSchema } from "../../../schemas/registry";
import { schema as defaultStructuredContextSchema } from "../schema/structuredContext";
import { assessContextCompleteness, assertStructuredContextShape, SCHEMA_ID, SCHEMA_VERSION } from "../schema/structuredContext";
import { buildKey, getExtraction, setExtraction } from "../../../cache/extractionCache";
import { runTask } from "../../../executors/taskRunner";
import { collectLowConfidence } from "../schema/structuredContext";
import { staticProfile } from "../../../capabilities/staticCapabilities";
import { AiError, AiErrorCode } from "../../../types/errors";

const LIST_FIELDS = [
  "topics", "concepts", "objectives", "definitions", "formulas", "dates",
  "terminology", "importantFacts", "learningOutcomes", "questionHints",
  "difficultyClues", "missingInformation", "ambiguities", "unsupportedAreas",
];
const TEACHER_HINT_FIELDS = ["subject", "grade", "lessonTitle", "language"];

export function normalizeTeacherHints(hints = {}) {
  return Object.fromEntries(TEACHER_HINT_FIELDS
    .map((field) => [field, typeof hints[field] === "string" ? hints[field].trim() : ""])
    .filter(([, value]) => value));
}

export function applyTeacherHints(context, hints = {}) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return context;
  return { ...context, ...normalizeTeacherHints(hints) };
}

function recordCompletenessWarning(ctx, context) {
  const completeness = assessContextCompleteness(context);
  if (!completeness.complete) {
    ctx.warnings = (ctx.warnings || []).concat({
      stage: "ai-extraction",
      code: "AI_CONTEXT_INCOMPLETE",
      message: "StructuredContext is incomplete; MissingInfo must collect the missing fields",
      missing: completeness.missing,
    });
  }
}

const stage = {
  name: "ai-extraction",
  async run(ctx) {
    const feature = ctx.feature || "repository";
    const hints = ctx.hints || {};

    const textForPrompt = ctx.text || (ctx.normalizedInput && ctx.normalizedInput.text) || "";

    if (!textForPrompt && !ctx.useNativeFile) {
      return {
        fatal: true,
        errors: [{ stage: "ai-extraction", code: "AI_EXTRACTION_FAILED", message: "No normalized text available for extraction" }],
      };
    }

    const rendered = await renderPrompt(
      "knowledge-extraction",
      { text: textForPrompt, grade: hints.grade, subject: hints.subject, lessonTitle: hints.lessonTitle, language: hints.language },
      { version: ctx.promptVersion }
    );
    const { system, user } = rendered.text;
    const resolvedPromptVersion = rendered.version;

    const schema = getSchema(SCHEMA_ID, SCHEMA_VERSION) || defaultStructuredContextSchema;

    let cacheKey = null;
    if (!ctx.skipCache) {
      const adapterForProfile = ctx.preferredAdapter;
      const providerId = adapterForProfile?.id || null;
      const modelId = ctx.model || null;
      const profile = adapterForProfile ? staticProfile(adapterForProfile, { model: ctx.model }) : {};
      const { key } = buildKey({
        normalizedInput: textForPrompt || ctx.fileHash || "",
        promptId: "knowledge-extraction",
        promptVersion: resolvedPromptVersion,
        schemaId: SCHEMA_ID,
        schemaVersion: SCHEMA_VERSION,
        providerId,
        modelId,
        capabilityProfile: profile,
        extra: { hints: normalizeTeacherHints(hints) },
      });
      cacheKey = key;
      const cached = await getExtraction(key);
      if (cached) {
        ctx.output = applyTeacherHints(cached.context, hints);
        recordCompletenessWarning(ctx, ctx.output);
        ctx.cacheHit = true;
        ctx.provider = cached.provider || null;
        ctx.model = cached.model || null;
        ctx.promptId = "knowledge-extraction";
        ctx.promptVersion = cached.promptVersion || ctx.promptVersion || "v1";
        return { success: true };
      }
    }

    let result;
    try {
      result = await runTask({
        type: "extraction",
        feature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        schema: null,
        model: ctx.model,
        prefer: ctx.prefer,
        _promptId: "knowledge-extraction",
        _promptVersion: ctx.promptVersion,
        files: ctx.useNativeFile && ctx.nativeFileRef ? [ctx.nativeFileRef] : undefined,
      });
    } catch (err) {
      return {
        fatal: true,
        errors: [{
          stage: "ai-extraction",
          code: err instanceof AiError ? err.code : AiErrorCode.EXTRACTION_FAILED,
          message: err?.message || "extraction task failed",
          extra: err?.extra,
        }],
      };
    }

    const context = applyTeacherHints(normalizeStructuredContext(unwrapStructuredContext(result.object)), hints);
    const shapeAssertion = schema.assertShape
      ? schema.assertShape(context)
      : assertStructuredContextShape(context);
    if (!shapeAssertion.ok) {
      return {
        fatal: true,
        errors: shapeAssertion.errors.map((msg) => ({ stage: "ai-extraction", code: AiErrorCode.ASSERTION_FAILED, message: msg })),
      };
    }

    recordCompletenessWarning(ctx, context);
    collectLowConfidence(context);
    if (context._meta) {
      context._meta.schemaVersion = SCHEMA_VERSION;
      context._meta.promptId = "knowledge-extraction";
      context._meta.promptVersion = ctx.promptVersion || "v1";
      context._meta.provider = result.provider;
      context._meta.model = result.model;
      context._meta.extractedAt = new Date().toISOString();
    }

    ctx.output = context;
    ctx.provider = result.provider;
    ctx.model = result.model;
    ctx.usage = result.usage;
    ctx.cost = result.cost;
    ctx.retries = result.retries;

    if (cacheKey && !ctx.skipCache) {
      await setExtraction(cacheKey, {
        context,
        provider: result.provider,
        model: result.model,
        promptVersion: ctx.promptVersion || "v1",
      });
    }

    return { success: true };
  },
};

export default stage;

export function normalizeStructuredContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const context = { ...value };
  for (const field of LIST_FIELDS) {
    if (!(field in context) || context[field] == null || Array.isArray(context[field])) continue;
    if (typeof context[field] === "string" && context[field].trim()) {
      context[field] = [context[field]];
    }
  }
  return context;
}

function unwrapStructuredContext(value) {
  if (!value || typeof value !== "object") return value;
  for (const key of ["context", "structuredContext", "data"]) {
    if (value[key] && typeof value[key] === "object") {
      return value[key];
    }
  }
  return value;
}
