import { capsFor } from "./BudgetPolicy";
import { budgetStore } from "./budgetStore";
import { AiError, AiErrorCode } from "../types/errors";
import { emitBudgetEvent } from "../metrics/aiMetrics";

const MONTH_TTL = 32 * 86_400;
const DAY_TTL = 2 * 86_400;

function scopeGlobal() {
  return "global";
}
function scopeFeature(feature) {
  return "feature:" + (feature || "unknown");
}
function scopeProvider(providerId) {
  return "provider:" + (providerId || "unknown");
}

export async function preflight({ feature, providerId, estCost = null }) {
  const caps = capsFor(feature, providerId);
  const est = Number.isFinite(estCost) && estCost > 0 ? estCost : 0;

  if (caps.globalMonthly != null) {
    const spent = await budgetStore.readMonthly(scopeGlobal());
    if (spent + est > caps.globalMonthly) {
      return { allowed: false, kind: "global", period: "monthly", cap: caps.globalMonthly, spent };
    }
  }

  if (caps.globalDaily != null) {
    const spent = await budgetStore.readDaily(scopeGlobal());
    if (spent + est > caps.globalDaily) {
      return { allowed: false, kind: "global", period: "daily", cap: caps.globalDaily, spent };
    }
  }

  if (caps.featureMonthly != null) {
    const spent = await budgetStore.readMonthly(scopeFeature(feature));
    if (spent + est > caps.featureMonthly) {
      return { allowed: false, kind: "feature", period: "monthly", cap: caps.featureMonthly, spent, feature };
    }
  }

  if (caps.providerMonthly != null) {
    const spent = await budgetStore.readMonthly(scopeProvider(providerId));
    if (spent + est > caps.providerMonthly) {
      return { allowed: false, kind: "provider", period: "monthly", cap: caps.providerMonthly, spent, provider: providerId };
    }
  }

  return { allowed: true, caps };
}

export async function recordSpend({ feature, providerId, amount }) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const caps = capsFor(feature, providerId);
  const tasks = [];
  if (caps.globalMonthly != null) tasks.push(budgetStore.addMonthly(scopeGlobal(), amount));
  if (caps.globalDaily != null) tasks.push(budgetStore.addDaily(scopeGlobal(), amount));
  if (caps.featureMonthly != null) tasks.push(budgetStore.addMonthly(scopeFeature(feature), amount));
  if (caps.providerMonthly != null) tasks.push(budgetStore.addMonthly(scopeProvider(providerId), amount));
  const results = await Promise.all(tasks).catch(() => null);
  return results;
}

export function budgetExceededError(decision) {
  const reason = decision.kind === "provider"
    ? `Provider budget exceeded: ${decision.provider}`
    : `${decision.kind} ${decision.period} budget exceeded`;
  emitBudgetEvent("exceeded", { kind: decision.kind, period: decision.period, cap: decision.cap, feature: decision.feature, provider: decision.provider });
  return new AiError(AiErrorCode.BUDGET_EXCEEDED, reason, {
    kind: decision.kind,
    period: decision.period,
    cap: decision.cap,
    spent: decision.spent,
  });
}

export { MONTH_TTL, DAY_TTL };