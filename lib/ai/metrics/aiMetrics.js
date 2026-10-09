import { emit } from "../../trace/emit.js";
import { redact } from "../security/redaction.js";

function safe(fn) {
  try { return fn(); } catch { return undefined; }
}

export function emitAiEvent(event, fields = {}) {
  safe(() => emit(`ai_${event}`, redact(fields)));
}

export function emitAiRun(record) {
  safe(() => emit("ai_run", redact(record)));
}

export function emitCacheEvent(event, fields = {}) {
  safe(() => emit(`ai_cache_${event}`, redact(fields)));
}

export function emitBudgetEvent(event, fields = {}) {
  safe(() => emit(`ai_budget_${event}`, redact(fields)));
}

export function emitBreakerEvent(event, fields = {}) {
  safe(() => emit(`ai_breaker_${event}`, redact(fields)));
}