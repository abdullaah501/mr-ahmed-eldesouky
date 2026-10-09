import { describe, it, expect } from "vitest";
import { deterministicCacheKey, shortKey } from "../../lib/ai/cache/cacheKey";

function key(input) {
  return deterministicCacheKey(input);
}

describe("deterministicCacheKey", () => {
  it("is stable for identical inputs", () => {
    const a = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "1", providerId: "google", modelId: "gemini-2.5-flash", capabilityProfile: { a: true, b: false } });
    const b = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "1", providerId: "google", modelId: "gemini-2.5-flash", capabilityProfile: { b: false, a: true } });
    expect(a).toBe(b);
  });

  it("changes when prompt version changes", () => {
    const a = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "1", providerId: "g", modelId: "m" });
    const b = key({ normalizedInput: "x", promptId: "p", promptVersion: "v2", schemaId: "s", schemaVersion: "1", providerId: "g", modelId: "m" });
    expect(a).not.toBe(b);
  });

  it("changes when schema version changes", () => {
    const a = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "1", providerId: "g", modelId: "m" });
    const b = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "2", providerId: "g", modelId: "m" });
    expect(a).not.toBe(b);
  });

  it("changes when capability profile changes", () => {
    const a = key({ normalizedInput: "x", providerId: "g", modelId: "m", capabilityProfile: { vision: true } });
    const b = key({ normalizedInput: "x", providerId: "g", modelId: "m", capabilityProfile: { vision: false } });
    expect(a).not.toBe(b);
  });

  it("changes when normalized input changes", () => {
    const a = key({ normalizedInput: "x", providerId: "g", modelId: "m" });
    const b = key({ normalizedInput: "y", providerId: "g", modelId: "m" });
    expect(a).not.toBe(b);
  });

  it("changes when providerId differs (same modelId, same caps)", () => {
    const a = key({ normalizedInput: "x", providerId: "openrouter", modelId: "gemma", capabilityProfile: { jsonMode: true } });
    const b = key({ normalizedInput: "x", providerId: "google", modelId: "gemma", capabilityProfile: { jsonMode: true } });
    expect(a).not.toBe(b);
  });

  it("changes when modelId differs (same providerId, same caps)", () => {
    const a = key({ normalizedInput: "x", providerId: "google", modelId: "gemini-2.5-flash", capabilityProfile: { vision: false } });
    const b = key({ normalizedInput: "x", providerId: "google", modelId: "gemini-2.5-pro", capabilityProfile: { vision: false } });
    expect(a).not.toBe(b);
  });

  it("same providerId + modelId + everything → same key (idempotence)", () => {
    const a = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "1", providerId: "google", modelId: "gemini-2.5-flash", capabilityProfile: { vision: false } });
    const b = key({ normalizedInput: "x", promptId: "p", promptVersion: "v1", schemaId: "s", schemaVersion: "1", providerId: "google", modelId: "gemini-2.5-flash", capabilityProfile: { vision: false } });
    expect(a).toBe(b);
  });

  it("changes when generation params differ (extra)", () => {
    const base = { normalizedInput: "ctx", promptId: "knowledge-extraction", promptVersion: "v1", schemaId: "structured-context", schemaVersion: "1", providerId: "google", modelId: "gemini-3.1-flash-lite", capabilityProfile: { vision: false } };
    expect(key({ ...base, extra: { questionCount: 5 } })).not.toBe(key({ ...base, extra: { questionCount: 7 } }));
  });

  it("changes when focusTopic differs (extra)", () => {
    const base = { normalizedInput: "ctx", providerId: "google", modelId: "gemini-3.1-flash-lite", capabilityProfile: {} };
    expect(key({ ...base, extra: { focusTopic: "equations" } })).not.toBe(key({ ...base, extra: { focusTopic: "geometry" } }));
  });

  it("treats absent extra same as empty object", () => {
    const base = { normalizedInput: "x", providerId: "g", modelId: "m", capabilityProfile: {} };
    expect(key(base)).toBe(key({ ...base, extra: {} }));
  });

  it("shortKey prefixes the hash", () => {
    const hash = key({ normalizedInput: "x" });
    expect(shortKey(hash)).toMatch(/^ai:ext:/);
  });
});
