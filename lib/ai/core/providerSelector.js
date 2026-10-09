import { listProviders } from "../providers/registry";
import { aiEnv } from "../config/env";
import * as breaker from "./circuitBreaker";
import { runtimeFlags } from "../capabilities/runtimeCapabilities";
import { staticSupports } from "../capabilities/staticCapabilities";
import { AiError, AiErrorCode } from "../types/errors";

function providerHasKey(adapter) {
  if (typeof adapter.apiKey === "function") return Boolean(adapter.apiKey());
  return Boolean(adapter._apiKey);
}

export function select({ require = [], prefer } = {}) {
  const env = aiEnv();
  const order = env.order;
  const disabled = env.disabled;

  const all = listProviders();
  const byId = new Map(all.map((p) => [p.id, p]));

  const ordered = [];
  for (const id of order) {
    const p = byId.get(id);
    if (p) ordered.push(p);
  }
  for (const p of all) {
    if (!ordered.includes(p)) ordered.push(p);
  }

  const candidates = [];
  const skipped = [];

  for (const adapter of ordered) {
    const rt = runtimeFlags(adapter, { disabledSet: disabled });
    const configured = providerHasKey(adapter);

    const staticOk = require.every((cap) => staticSupports(adapter, cap));
    const skipReasons = [];

    if (adapter.implemented === false) skipReasons.push("not-implemented");
    if (rt.disabled) skipReasons.push("disabled");
    if (!configured) skipReasons.push("unconfigured");
    if (rt.circuitOpen) skipReasons.push("circuit-open");
    if (rt.cooldown) skipReasons.push("cooldown");
    if (!staticOk) skipReasons.push("capability-missing");

    if (skipReasons.length === 0) {
      candidates.push({ adapter, runtime: rt });
    } else {
      skipped.push({ id: adapter.id, reasons: skipReasons });
    }
  }

  if (prefer && byId.has(prefer)) {
    const preferred = byId.get(prefer);
    candidates.sort((a, b) => (a.adapter.id === prefer ? -1 : b.adapter.id === prefer ? 1 : 0));
  }

  return {
    candidates: candidates.map((c) => c.adapter),
    skipped,
  };
}

export function requireOne(options) {
  const { candidates, skipped } = select(options);
  if (candidates.length === 0) {
    const anyConfigured = skipped.some((s) => !s.reasons.includes("unconfigured"));
    const code = anyConfigured ? AiErrorCode.NO_PROVIDER : AiErrorCode.NO_CONFIGURED_PROVIDER;
    throw new AiError(code, "No AI provider available for the requested capabilities", { required: options.require || [], skipped });
  }
  return candidates;
}

export { breaker };