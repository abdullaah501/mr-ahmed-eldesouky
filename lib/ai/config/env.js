import { AI_DEFAULTS } from "./defaults";

let cache = null;

function stripSurroundingQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function parseOrder() {
  const raw = stripSurroundingQuotes(process.env.AI_PROVIDER_ORDER || "");
  if (!raw) return [...AI_DEFAULTS.defaultOrder];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseDisabled() {
  const raw = stripSurroundingQuotes(process.env.AI_PROVIDER_DISABLED || "");
  if (!raw) return new Set();
  return new Set(
    raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
}

function boolDefault(envName, fallback) {
  if (process.env[envName] === undefined) return fallback;
  return String(process.env[envName]) === "true";
}

function build() {
  return {
    enabled: boolDefault("AI_ENABLED", AI_DEFAULTS.enabled),
    debug: boolDefault("AI_DEBUG", AI_DEFAULTS.debug),
    order: parseOrder(),
    disabled: parseDisabled(),
    providerKeys: {
      google: process.env.GOOGLE_AI_API_KEY || "",
      groq: process.env.GROQ_API_KEY || "",
      opencode: process.env.OPENCODE_API_KEY || "",
      openrouter: process.env.OPENROUTER_API_KEY || "",
    },
    providerBases: {
      opencode: process.env.OPENCODE_BASE_URL || "",
    },
    defaultModels: {
      google: process.env.AI_DEFAULT_MODEL_GOOGLE || "gemini-2.5-flash",
      groq: process.env.AI_DEFAULT_MODEL_GROQ || "llama-3.3-70b-versatile",
      opencode: process.env.AI_DEFAULT_MODEL_OPENCODE || "kimi-k3",
      openrouter:
        process.env.AI_DEFAULT_MODEL_OPENROUTER ||
        "google/gemma-4-26b-a4b-it:free",
    },
    budgets: {
      globalMonthly: process.env.AI_BUDGET_GLOBAL_MONTHLY || "",
      globalDaily: process.env.AI_BUDGET_GLOBAL_DAILY || "",
      featureRepositoryMonthly:
        process.env.AI_BUDGET_FEATURE_REPOSITORY_MONTHLY || "",
      provider: {
        google: process.env.AI_BUDGET_PROVIDER_GOOGLE_MONTHLY || "",
        groq: process.env.AI_BUDGET_PROVIDER_GROQ_MONTHLY || "",
        opencode: process.env.AI_BUDGET_PROVIDER_OPENCODE_MONTHLY || "",
        openrouter: process.env.AI_BUDGET_PROVIDER_OPENROUTER_MONTHLY || "",
      },
    },
    runStore: process.env.AI_RUN_STORE || "null",
    promptSelection: {
      "knowledge-extraction":
        process.env.AI_PROMPT_EXTRACTION || "v2",
      "question-generation":
        process.env.AI_PROMPT_QUESTION_GENERATION || "v2",
    },
  };
}

export function aiEnv() {
  if (!cache) cache = build();
  return cache;
}

export function reloadAiEnv() {
  cache = null;
  return aiEnv();
}

export function isEnabled() {
  return aiEnv().enabled;
}
