import { renderPrompt } from "../../../prompts/PromptManager";
import { assertDraftQuestions, SCHEMA_ID, SCHEMA_VERSION } from "../schema/draftQuestions";
import { buildGenerationKey, getGeneration, setGeneration } from "../../../cache/generationCache";
import { runTask } from "../../../executors/taskRunner";
import { staticProfile } from "../../../capabilities/staticCapabilities";
import { wrapEnvelope } from "../../shared/envelope";
import { AiError, AiErrorCode } from "../../../types/errors";

export function buildGenerationCacheInput(context) {
  if (!context || typeof context !== "object" || Array.isArray(context) || !context._meta) return context || {};
  const semanticMeta = { ...context._meta };
  for (const field of ["provider", "model", "promptId", "promptVersion", "extractedAt", "schemaVersion"]) {
    delete semanticMeta[field];
  }
  return {
    ...context,
    ...(Object.keys(semanticMeta).length ? { _meta: semanticMeta } : { _meta: undefined }),
  };
}

// Mirror of the UI's supported maximum (GenerationSettingsStep max="100").
export const MAX_QUESTIONS_PER_REQUEST = 100;
// Tightest provider output cap is 8,192 tokens (google/models.js). Ten
// DraftQuestions serialize to ~1.5-2.5k tokens — safely inside that budget,
// so large requests are split into continuation batches instead of relying
// on one oversized response.
export const MAX_QUESTIONS_PER_CALL = 10;

export function resolveRequestedCount(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (n < 1) return 1;
  return Math.min(n, MAX_QUESTIONS_PER_REQUEST);
}

const stage = {
  name: "ai-question-generation",
  async run(ctx) {
    const context = ctx.inputs.context;
    const params = ctx.inputs.generationParams || {};
    const feature = ctx.feature || "repository";

    const requested = resolveRequestedCount(params.questionCount);
    // The regenerate-one path targets a specific question — keep it a
    // single call exactly as before.
    const isTargetedCall = params.focusIndex != null;
    const totalCalls = isTargetedCall
      ? 1
      : Math.ceil(requested / MAX_QUESTIONS_PER_CALL);

    const profile = ctx.preferredAdapter ? staticProfile(ctx.preferredAdapter, { model: ctx.model }) : {};

    const collected = [];
    let meta = { provider: null, model: null, promptVersion: null };
    let totalCost = 0;
    let totalRetries = 0;
    let allCacheHits = true;

    for (let batchIndex = 0; batchIndex < totalCalls; batchIndex++) {
      const remaining = requested - collected.length;
      const batchSize = Math.min(remaining, MAX_QUESTIONS_PER_CALL);
      const batchParams = { ...params, questionCount: batchSize };

      const rendered = await renderPrompt(
        "question-generation",
        {
          structuredContext: context,
          grade: batchParams.grade || context?.grade,
          subject: batchParams.subject || context?.subject,
          difficulty: batchParams.difficulty,
          questionCount: batchParams.questionCount,
          questionTypes: batchParams.questionTypes,
          bloomLevel: batchParams.bloomLevel,
          outputPreferences: batchParams.outputPreferences,
          focusIndex: batchParams.focusIndex,
          focusTopic: batchParams.focusTopic,
        },
        { version: ctx.promptVersion }
      );
      const { system, user } = rendered.text;
      const resolvedPromptVersion = rendered.version;

      // Cache keys stay byte-identical for the single-call path (no
      // batchIndex) and remain deterministic per batch for continuations.
      const cacheParams =
        totalCalls > 1 ? { ...batchParams, batchIndex } : batchParams;
      const contextJson = JSON.stringify(buildGenerationCacheInput(context));

      let cacheKey = null;
      if (!ctx.skipCache) {
        const { key } = buildGenerationKey({
          normalizedInput: contextJson,
          promptVersion: resolvedPromptVersion,
          providerId: ctx.preferredAdapter?.id || null,
          modelId: ctx.model || null,
          capabilityProfile: profile,
          generationParams: cacheParams,
        });
        cacheKey = key;
        const cached = await getGeneration(key);
        if (cached) {
          collected.push(...cached.questions);
          meta = {
            provider: cached.provider || meta.provider,
            model: cached.model || meta.model,
            promptVersion: cached.promptVersion || resolvedPromptVersion,
          };
          if (collected.length >= requested) break;
          continue;
        }
      }
      allCacheHits = false;

      let result;
      try {
        result = await runTask({
          type: "object",
          feature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          schema: null,
          model: ctx.model,
          prefer: ctx.prefer,
          _promptId: "question-generation",
          _promptVersion: resolvedPromptVersion,
        });
      } catch (err) {
        return {
          fatal: true,
          errors: [{
            stage: "ai-question-generation",
            code: err instanceof AiError ? err.code : AiErrorCode.BAD_RESPONSE,
            message: err?.message || "question generation failed",
            extra: err?.extra,
          }],
        };
      }

      const batchQuestions = Array.isArray(result.object)
        ? result.object
        : (result.object?.questions || []);
      const assertion = assertDraftQuestions(batchQuestions);
      if (!assertion.ok) {
        return {
          fatal: true,
          errors: assertion.errors.map((msg) => ({ stage: "ai-question-generation", code: AiErrorCode.ASSERTION_FAILED, message: msg })),
        };
      }

      collected.push(...batchQuestions);
      meta = {
        provider: result.provider || meta.provider,
        model: result.model || meta.model,
        promptVersion: resolvedPromptVersion,
      };
      totalCost += result.cost || 0;
      totalRetries += result.retries || 0;

      if (cacheKey && !ctx.skipCache) {
        await setGeneration(cacheKey, {
          questions: batchQuestions,
          provider: result.provider,
          model: result.model,
          promptVersion: resolvedPromptVersion,
        });
      }

      if (collected.length >= requested) break;
    }

    const questions = collected.slice(0, requested);
    ctx.outputs.questions = questions;
    ctx.provider = meta.provider;
    ctx.model = meta.model;
    ctx.cost = totalCost;
    ctx.retries = totalRetries;
    ctx.promptVersion = meta.promptVersion;
    ctx.cacheHit = allCacheHits;

    const artifact = wrapEnvelope(
      "draft-questions",
      SCHEMA_VERSION,
      { questions },
      { taskId: ctx.taskId, provider: meta.provider, model: meta.model, promptVersion: meta.promptVersion, schemaVersion: SCHEMA_VERSION },
      ctx.parentArtifactId || null
    );
    ctx.artifacts.draftQuestions = artifact;

    return { success: true, artifact };
  },
};

export default stage;
