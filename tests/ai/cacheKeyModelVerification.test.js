import { describe, it, expect } from "vitest";
import { deterministicCacheKey } from "../../lib/ai/cache/cacheKey";
import { listProviders } from "../../lib/ai/providers/registry";
import "../../lib/ai/providers";
import { buildGenerationKey } from "../../lib/ai/cache/generationCache";

function keyFor(provider, modelId, input = "test-input") {
  const profile = (provider.models || []).find((m) => m.id === modelId)?.capabilities || provider.capabilities;
  return deterministicCacheKey({
    normalizedInput: input,
    promptId: "knowledge-extraction",
    promptVersion: "v1",
    schemaId: "structured-context",
    schemaVersion: "1",
    providerId: provider.id,
    modelId,
    capabilityProfile: profile,
  });
}

describe("cache-key differentiation — identical capability profiles", () => {
  it("google: all 3 models have identical declared capabilities → cache keys differ by modelId", () => {
    const p = listProviders().find((x) => x.id === "google");
    const a = keyFor(p, "gemini-3.5-flash-lite");
    const b = keyFor(p, "gemini-3.1-flash-lite");
    const c = keyFor(p, "gemini-3.6-flash");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it("groq: models differ → keys differ by modelId", () => {
    const p = listProviders().find((x) => x.id === "groq");
    const gptOss120 = keyFor(p, "openai/gpt-oss-120b");
    const gptOss20 = keyFor(p, "openai/gpt-oss-20b");
    expect(gptOss120).not.toBe(gptOss20);
  });

  it("openrouter: models differ → keys differ by modelId", () => {
    const p = listProviders().find((x) => x.id === "openrouter");
    const lfm = keyFor(p, "liquid/lfm-2.5-2.6b:free");
    const laguna = keyFor(p, "poolside/laguna-s-2.1:free");
    const north = keyFor(p, "cohere/north-mini-code:free");
    expect(lfm).not.toBe(laguna);
    expect(lfm).not.toBe(north);
    expect(laguna).not.toBe(north);
  });

  it("opencode: models differ → keys differ by modelId", () => {
    const p = listProviders().find((x) => x.id === "opencode");
    const mimo = keyFor(p, "mimo-v2.5-free");
    const deepseek = keyFor(p, "deepseek-v4-flash-free");
    const ling = keyFor(p, "ling-3.0-flash-free");
    expect(mimo).not.toBe(deepseek);
    expect(mimo).not.toBe(ling);
    expect(deepseek).not.toBe(ling);
  });

  it("same provider + model → same key (idempotence preserved)", () => {
    const p = listProviders().find((x) => x.id === "google");
    const a = keyFor(p, "gemini-3.1-flash-lite");
    const b = keyFor(p, "gemini-3.1-flash-lite");
    expect(a).toBe(b);
  });

  it("different provider, same model id string → different key (providerId protects)", () => {
    const or = listProviders().find((x) => x.id === "openrouter");
    const oc = listProviders().find((x) => x.id === "opencode");
    const a = keyFor(or, "liquid/lfm-2.5-2.6b:free");
    const b = keyFor(oc, "liquid/lfm-2.5-2.6b:free");
    expect(a).not.toBe(b);
  });
});

describe("buildGenerationKey respects generation params via extra", () => {
  it("produces different keys for different questionCount", () => {
    const p = listProviders().find((x) => x.id === "groq");
    const a = buildGenerationKey({ normalizedInput: "ctx", providerId: p.id, modelId: "openai/gpt-oss-120b", capabilityProfile: p.capabilities, generationParams: { questionCount: 5 } });
    const b = buildGenerationKey({ normalizedInput: "ctx", providerId: p.id, modelId: "openai/gpt-oss-120b", capabilityProfile: p.capabilities, generationParams: { questionCount: 7 } });
    expect(a.hash).not.toBe(b.hash);
    expect(a.key).not.toBe(b.key);
  });

  it("produces same key for same params", () => {
    const p = listProviders().find((x) => x.id === "groq");
    const a = buildGenerationKey({ normalizedInput: "ctx", providerId: p.id, modelId: "openai/gpt-oss-120b", capabilityProfile: p.capabilities, generationParams: { questionCount: 5 } });
    const b = buildGenerationKey({ normalizedInput: "ctx", providerId: p.id, modelId: "openai/gpt-oss-120b", capabilityProfile: p.capabilities, generationParams: { questionCount: 5 } });
    expect(a.hash).toBe(b.hash);
  });
});
