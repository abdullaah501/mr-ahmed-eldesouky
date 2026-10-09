import { createMemcachedAdapter } from "../../storage/MemcachedAdapter";
import { AI_DEFAULTS } from "../config/defaults";
import { deterministicCacheKey, shortKey } from "./cacheKey";
import { emitCacheEvent } from "../metrics/aiMetrics";

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

export function buildKey(parts) {
  const hash = deterministicCacheKey(parts);
  return { hash, key: shortKey(hash) };
}

export async function getExtraction(key) {
  const store = getAdapter();
  if (!store) return null;
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    emitCacheEvent("get_error", { error: String(err.message || err).slice(0, 200) });
    return null;
  }
}

export async function setExtraction(key, value) {
  const store = getAdapter();
  if (!store) return false;
  try {
    await store.set(key, JSON.stringify(value), {
      expires: AI_DEFAULTS.cache.extractionTtlSeconds,
    });
    return true;
  } catch (err) {
    emitCacheEvent("set_error", { error: String(err.message || err).slice(0, 200) });
    return false;
  }
}

export function resetCacheAdapter() {
  adapter = null;
}