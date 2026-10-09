import * as breaker from "../core/circuitBreaker";

export function runtimeFlags(adapter, { disabledSet = new Set() } = {}) {
  const b = breaker.inspect(adapter.id);
  return {
    healthy: b.healthy,
    disabled: disabledSet.has(adapter.id),
    cooldown: b.onCooldown,
    circuitOpen: b.circuitOpen,
    quotaAvailable: true,
    budgetAvailable: true,
    estimatedLatencyMs: null,
    available: b.healthy && !disabledSet.has(adapter.id) && !b.onCooldown,
  };
}