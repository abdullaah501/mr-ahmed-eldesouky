import { aiEnv } from "../config/env";

function numOr(value, fallback = null) {
  if (value === "" || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function slug(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function globalMonthlyCap() {
  return numOr(aiEnv().budgets.globalMonthly);
}

export function globalDailyCap() {
  return numOr(aiEnv().budgets.globalDaily);
}

export function featureMonthlyCap(feature) {
  const explicit = aiEnv().budgets.featureRepositoryMonthly;
  if (slug(feature) === "REPOSITORY" && explicit !== "") {
    return numOr(explicit);
  }
  const envKey = `AI_BUDGET_FEATURE_${slug(feature)}_MONTHLY`;
  return numOr(process.env[envKey]);
}

export function providerMonthlyCap(providerId) {
  const known = aiEnv().budgets.provider[providerId];
  if (known && known !== "") return numOr(known);
  const envKey = `AI_BUDGET_PROVIDER_${slug(providerId)}_MONTHLY`;
  return numOr(process.env[envKey]);
}

export function anyCapsConfigured() {
  if (globalMonthlyCap() != null) return true;
  if (globalDailyCap() != null) return true;
  return false;
}

export function capsFor(feature, providerId) {
  return {
    globalMonthly: globalMonthlyCap(),
    globalDaily: globalDailyCap(),
    featureMonthly: featureMonthlyCap(feature),
    providerMonthly: providerMonthlyCap(providerId),
  };
}