import { requireOne } from "../core/providerSelector";
import * as breaker from "../core/circuitBreaker";
import { withRetry } from "../core/retryPolicy";
import { getRunStore } from "../core/runStore";
import { buildRun } from "../core/usageTracker";
import { AI_DEFAULTS } from "../config/defaults";
import { AiError, AiErrorCode, isRetryableError } from "../types/errors";
import { preflight as budgetPreflight, recordSpend, budgetExceededError } from "../budget/BudgetManager";
import { emitAiEvent, emitAiRun, emitBreakerEvent } from "../metrics/aiMetrics";
import { aiEnv } from "../config/env";
import { getExecutor } from "./registry";
import crypto from "crypto";

function isStreamTask(task) {
  return task && task.type === "stream";
}

function requireCapFor(type) {
  if (type === "vision") return ["vision"];
  if (type === "object" || type === "extraction") return ["structured-output"];
  return [];
}

function orderedChain(task) {
  const required = requireCapFor(task.type);
  const candidates = requireOne({ require: required, prefer: task.prefer });
  return candidates;
}

export async function runTask(task) {
  if (!task || !task.type) {
    throw new AiError(AiErrorCode.INVALID_TASK, "task.type is required");
  }

  const executor = getExecutor(task.type);
  if (!executor) {
    throw new AiError(AiErrorCode.UNKNOWN_WORKFLOW, `No executor registered for task type "${task.type}"`);
  }

  let budgetResult = { allowed: true, caps: null };
  try {
    budgetResult = await budgetPreflight({ feature: task.feature });
  } catch (e) {
    if (e instanceof AiError && e.code === AiErrorCode.BUDGET_EXCEEDED) throw e;
    emitAiEvent("budget_preflight_error", { feature: task.feature, error: String(e.message || e).slice(0, 200) });
    budgetResult = { allowed: true, caps: null };
  }

  if (!budgetResult.allowed) {
    const err = budgetExceededError(budgetResult);
    emitAiEvent("request_denied_budget", { feature: task.feature, kind: budgetResult.kind });
    throw err;
  }

  const runId = crypto.randomUUID();
  const chain = orderedChain(task);
  const fallbackChain = [...chain];
  const originalProvider = task.prefer || chain[0]?.id || null;
  const preferredProvider = originalProvider;
  const totalChain = chain.length;
  let lastErr;
  let fallbackIndex = 0;
  const providersTried = [];

  while (fallbackChain.length > 0) {
    const adapter = fallbackChain.shift();
    if (!breaker.allow(adapter.id)) {
      emitBreakerEvent("skip_provider", { provider: adapter.id, reason: "open" });
      fallbackIndex++;
      continue;
    }

    let result;
    let attempts = 0;
    const retriesThisProvider = { count: 0 };
    let modelId;
    let modelSource;
    if (adapter.id === originalProvider && task.model) {
      modelId = task.model;
      modelSource = "user-selected";
    } else {
      const envDefault = aiEnv().defaultModels[adapter.id];
      if (envDefault && adapter.models?.some((m) => m.id === envDefault)) {
        modelId = envDefault;
        modelSource = "provider-config";
      } else {
        const defaultModel = adapter.models?.find((m) => m.default)?.id;
        if (defaultModel) {
          modelId = defaultModel;
          modelSource = "adapter-default";
        } else {
          modelId = adapter.models?.[0]?.id;
          modelSource = "first-available";
        }
      }
    }

    try {
      result = await withRetry(
        async () => {
          attempts += 1;
          emitAiEvent("provider_attempt", {
            runId,
            feature: task.feature,
            workflow: task.type,
            provider: adapter.id,
            model: modelId,
            modelSource,
            baseUrl: adapter.baseUrl || null,
            attempt: attempts,
            fallbackIndex,
            preferredProvider,
            totalChain,
            startTimestamp: new Date().toISOString(),
          });

          const adapterTask = { ...task, model: modelId };

          if (isStreamTask(task)) {
            return executor(adapter, adapterTask);
          }

          const res = await executor(adapter, adapterTask);
          return res;
        },
        {
          onRetry({ attempt, wait, err }) {
            retriesThisProvider.count += 1;
            emitAiEvent("retry", {
              runId,
              feature: task.feature,
              provider: adapter.id,
              attempt,
              waitMs: wait,
              error: err?.code || String(err?.message || err).slice(0, 160),
            });
          },
        }
      );
    } catch (err) {
      lastErr = err;
      providersTried.push({ id: adapter.id, model: modelId, success: false });

      breaker.recordFailure(adapter.id);
      emitBreakerEvent("failure", { runId, provider: adapter.id, code: err?.code || "unknown" });

      if (err instanceof AiError && err.code === AiErrorCode.BUDGET_EXCEEDED) throw err;

      if (fallbackChain.length > 0) {
        const nextAdapter = fallbackChain[0];
        emitAiEvent("provider_fallback", {
          runId,
          fromProvider: adapter.id,
          toProvider: nextAdapter.id,
          reason: err?.code || String(err?.message || err).slice(0, 300),
          attempt: attempts,
          fallbackIndex,
        });
      }

      if (fallbackChain.length === 0) {
        emitAiEvent("provider_final", {
          runId,
          totalAttempts: attempts + fallbackIndex,
          usedFallback: true,
          providersTried,
          successfulProvider: null,
          successfulModel: null,
          status: "all_failed",
        });
        const code = err instanceof AiError ? err.code : AiErrorCode.BAD_RESPONSE;
        throw new AiError(code, err?.message || "All providers failed", {
          requestedProvider: task.prefer || null,
          requestedModel: task.model || null,
          actualProvider: adapter.id,
          actualModel: modelId || null,
          fallback: fallbackIndex > 0,
          providersTried,
          lastProvider: adapter.id,
        });
      }
      fallbackIndex++;
      continue;
    }

    breaker.recordSuccess(adapter.id);
    providersTried.push({ id: adapter.id, model: modelId, success: true });

    emitAiEvent("provider_final", {
      runId,
      totalAttempts: attempts + fallbackIndex,
      usedFallback: fallbackIndex > 0,
      providersTried,
      successfulProvider: result.provider || adapter.id,
      successfulModel: result.model || modelId,
      status: "ok",
    });

    if (isStreamTask(task)) {
      return result;
    }

    const cost = adapter.estimateCost({ usage: result.usage, model: result.model }) ?? null;
    const record = buildRun({
      feature: task.feature,
      provider: result.provider || adapter.id,
      model: result.model,
      usage: result.usage,
      cost,
      latencyMs: null,
      retries: retriesThisProvider.count,
      cacheHit: task._cacheHit || false,
      status: "ok",
      promptId: task._promptId,
      promptVersion: task._promptVersion,
    });

    emitAiRun(record);
    try { getRunStore().recordRun(record); } catch { /* ignore */ }

    if (cost && cost > 0) {
      try {
        await recordSpend({ feature: task.feature, providerId: record.provider, amount: cost });
      } catch (e) {
        emitAiEvent("record_spend_error", { feature: task.feature, error: String(e.message || e).slice(0, 200) });
      }
    }

    return { ...result, cost, retries: retriesThisProvider.count };
  }

  emitAiEvent("provider_final", {
    runId: runId || crypto.randomUUID(),
    totalAttempts: chain.length,
    usedFallback: true,
    providersTried,
    successfulProvider: null,
    successfulModel: null,
    status: "all_failed",
  });

  const code = lastErr instanceof AiError ? lastErr.code : AiErrorCode.NO_PROVIDER;
  const msg = lastErr ? lastErr.message : "No eligible provider available";
  throw new AiError(code, msg, {
    requestedProvider: task.prefer || null,
    requestedModel: task.model || null,
    actualProvider: null,
    actualModel: null,
    fallback: false,
    providersTried,
  });
}
