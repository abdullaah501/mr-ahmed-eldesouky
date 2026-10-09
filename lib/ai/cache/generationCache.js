import { createMemcachedAdapter } from "../../storage/MemcachedAdapter";
import { deterministicCacheKey, shortKey } from "../cache/cacheKey";
import { emitCacheEvent } from "../metrics/aiMetrics";
import { SCHEMA_VERSION } from "../workflows/questionGeneration/schema/draftQuestions";

let adapter = null;

function getAdapter() {
  if (adapter !== null) return adapter;
  try {
    adapter = createMemcachedAdapter();
  } catch {
    adapter = false;
  }
  return adapter;
}

export function buildGenerationKey(parts) {
  const hash = deterministicCacheKey({
    normalizedInput: parts.normalizedInput || "",
    promptId: "question-generation",
    promptVersion: parts.promptVersion || "v1",
    schemaId: "draft-questions",
    schemaVersion: parts.schemaVersion || SCHEMA_VERSION,
    providerId: String(parts.providerId || ""),
    modelId: String(parts.modelId || ""),
    capabilityProfile: parts.capabilityProfile || {},
    extra: JSON.stringify(parts.generationParams || {}),
  });
  return { hash, key: shortKey(hash, "ai:gen") };
}

export async function getGeneration(key) {
  const store = getAdapter();
  if (!store) return null;
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    emitCacheEvent("get_error", { namespace: "gen", error: String(err.message || err).slice(0, 200) });
    return null;
  }
}

export async function setGeneration(key, value) {
  const store = getAdapter();
  if (!store) return false;
  try {
    await store.set(key, JSON.stringify(value), { expires: 3600 });
    return true;
  } catch (err) {
    emitCacheEvent("set_error", { namespace: "gen", error: String(err.message || err).slice(0, 200) });
    return false;
  }
}

export function resetGenerationCacheAdapter() {
  adapter = null;
}
