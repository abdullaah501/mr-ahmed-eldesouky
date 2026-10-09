function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildRun({
  feature,
  provider,
  model,
  usage,
  usageMetadata,
  cost,
  latencyMs,
  retries,
  cacheHit,
  status,
  promptId,
  promptVersion,
}) {
  const u = normalizeUsage(usage, usageMetadata);
  return {
    feature: feature || null,
    provider: provider || null,
    model: model || null,
    promptId: promptId || null,
    promptVersion: promptVersion || null,
    latencyMs: num(latencyMs),
    usage: u,
    cost: num(cost),
    retries: num(retries) || 0,
    cacheHit: Boolean(cacheHit),
    status: status || "ok",
    ts: new Date().toISOString(),
  };
}

export function normalizeUsage(usage, usageMetadata) {
  const src = usage || usageMetadata || {};
  return {
    promptTokens: num(src.promptTokens ?? src.promptTokenCount),
    completionTokens: num(src.completionTokens ?? src.candidatesTokenCount),
    totalTokens: num(src.totalTokens ?? src.totalTokenCount),
  };
}