import { AI_DEFAULTS } from "../config/defaults";

const states = new Map();

function initial() {
  return {
    status: "closed",
    consecutiveFailures: 0,
    openedAt: null,
    cooldownEndsAt: null,
    trips: 0,
  };
}

function get(id) {
  let s = states.get(id);
  if (!s) {
    s = initial();
    states.set(id, s);
  }
  return s;
}

export function allow(id) {
  const s = get(id);
  const now = Date.now();
  if (s.status === "closed") return true;
  if (s.status === "open") {
    if (s.cooldownEndsAt != null && now >= s.cooldownEndsAt) {
      s.status = "half-open";
      return true;
    }
    return false;
  }
  return false;
}

export function recordSuccess(id) {
  const s = get(id);
  s.status = "closed";
  s.consecutiveFailures = 0;
  s.openedAt = null;
  s.cooldownEndsAt = null;
}

export function recordFailure(id, { cooldownMs } = {}) {
  const s = get(id);
  s.consecutiveFailures += 1;

  const cfg = AI_DEFAULTS.breaker;
  const cd = cooldownMs ?? cfg.cooldownMs;

  let shouldOpen = s.consecutiveFailures >= cfg.failureThreshold;
  if (cooldownMs && cooldownMs > 0) shouldOpen = true;

  if (shouldOpen && s.status !== "half-open") {
    s.status = "open";
    s.openedAt = Date.now();
    s.cooldownEndsAt = Date.now() + cd;
    s.trips += 1;
  } else if (s.status === "half-open") {
    s.status = "open";
    s.openedAt = Date.now();
    s.cooldownEndsAt = Date.now() + cd;
    s.trips += 1;
  }
}

export function trip(id, { cooldownMs } = {}) {
  const s = get(id);
  const cfg = AI_DEFAULTS.breaker;
  s.status = "open";
  s.openedAt = Date.now();
  s.cooldownEndsAt = Date.now() + (cooldownMs ?? cfg.cooldownMs);
  s.trips += 1;
}

export function reset(id) {
  states.set(id, initial());
}

export function resetAll() {
  states.clear();
}

export function inspect(id) {
  const s = get(id);
  const now = Date.now();
  return {
    status: s.status,
    consecutiveFailures: s.consecutiveFailures,
    openedAt: s.openedAt,
    cooldownEndsAt: s.cooldownEndsAt,
    trips: s.trips,
    onCooldown: s.status === "open" && s.cooldownEndsAt != null && now < s.cooldownEndsAt,
    circuitOpen: s.status === "open" && (s.cooldownEndsAt == null || now < s.cooldownEndsAt),
    healthy: s.status === "closed" || (s.status === "open" && s.cooldownEndsAt != null && now >= s.cooldownEndsAt),
  };
}