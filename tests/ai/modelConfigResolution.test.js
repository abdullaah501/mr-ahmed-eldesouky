import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Drift-guard: every provider's configured env default model must actually
// exist in that provider's catalog. The silent-failure mode (env value not in
// the catalog -> taskRunner quietly substitutes the catalog default) masked a
// stale google/gemma model in production and a stale groq llama id - this
// test makes any such drift loud.
vi.hoisted(() => {
  process.env.TENANT_ID = process.env.TENANT_ID || "t1";
  process.env.AI_DEFAULT_MODEL_GOOGLE = "gemini-3.5-flash-lite";
  process.env.AI_DEFAULT_MODEL_GROQ = "openai/gpt-oss-120b";
  process.env.AI_DEFAULT_MODEL_OPENROUTER = "liquid/lfm-2.5-2.6b:free";
});

vi.mock("../../lib/ai/metrics/aiMetrics", () => ({
  emitAiEvent: vi.fn(),
  emitAiRun: vi.fn(),
  emitCacheEvent: vi.fn(),
  emitBudgetEvent: vi.fn(),
  emitBreakerEvent: vi.fn(),
}));

import { reloadAiEnv, aiEnv } from "../../lib/ai/config/env";
import { groqAdapter } from "../../lib/ai/providers/groq/adapter";
import { openrouterAdapter } from "../../lib/ai/providers/openrouter/adapter";
import { googleAdapter } from "../../lib/ai/providers/google/adapter";
import "../../lib/ai/providers";

const ENV_BAK = { ...process.env };

describe("provider model configuration resolution (drift guard)", () => {
  beforeEach(() => {
    reloadAiEnv();
  });

  it.each([
    ["google", googleAdapter],
    ["groq", groqAdapter],
    ["openrouter", openrouterAdapter],
  ])("%s: configured env default model exists in the adapter catalog", (id, adapter) => {
    const configured = aiEnv().defaultModels[id];
    expect(configured).toBeTruthy();
    const catalogIds = (adapter.models || []).map((m) => m.id);
    expect(catalogIds).toContain(configured);
  });

  it.each([
    ["google", googleAdapter],
    ["groq", groqAdapter],
    ["openrouter", openrouterAdapter],
  ])("%s: resolves to the CONFIGURED model, not an adapter-default substitution", (id, adapter) => {
    const configured = aiEnv().defaultModels[id];
    const resolved = taskRunnerResolveModel(id, configured, adapter);
    expect(resolved).toEqual({ modelId: configured, modelSource: "provider-config" });
  });
});

// Mirrors lib/ai/executors/taskRunner.js model-selection precedence without
// importing the full runner (selection logic contract under test):
// caller model -> env default (if in catalog) -> catalog default -> first.
function taskRunnerResolveModel(providerId, configured, adapter) {
  const modelSource = "catalog-default";
  void providerId;
  void modelSource;
  if (configured && adapter.models?.some((m) => m.id === configured)) {
    return { modelId: configured, modelSource: "provider-config" };
  }
  const defaultModel = adapter.models?.find((m) => m.default)?.id;
  if (defaultModel) return { modelId: defaultModel, modelSource: "adapter-default" };
  return { modelId: adapter.models?.[0]?.id, modelSource: "first-available" };
}

afterAll(() => {
  for (const key of Object.keys(ENV_BAK)) {
    if (ENV_BAK[key] === undefined) delete process.env[key];
    else process.env[key] = ENV_BAK[key];
  }
  reloadAiEnv();
});
