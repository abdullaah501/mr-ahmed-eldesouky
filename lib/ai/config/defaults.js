export const AI_DEFAULTS = {
  enabled: true,
  debug: false,
  defaultOrder: ["google", "opencode", "groq", "openrouter"],
  requestTimeoutMs: 60_000,
  maxRetries: 2,
  backoffInitialMs: 800,
  backoffMaxMs: 8_000,
  jitterMaxMs: 400,
  breaker: {
    failureThreshold: 4,
    cooldownMs: 60_000,
    halfOpenProbes: 1,
  },
  cache: {
    extractionTtlSeconds: Number(process.env.AI_EXTRACTION_CACHE_TTL) || 3600,
  },
  input: {
    maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS) || 200_000,
  },
  lowConfidence: {
    threshold: Number(process.env.AI_LOW_CONFIDENCE_THRESHOLD) || 0.5,
  },
};