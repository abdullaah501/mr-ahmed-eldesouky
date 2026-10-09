import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/ai/budget/budgetStore", () => ({
  budgetStore: {
    readMonthly: vi.fn().mockResolvedValue(0),
    readDaily: vi.fn().mockResolvedValue(0),
    addMonthly: vi.fn().mockResolvedValue(0),
    addDaily: vi.fn().mockResolvedValue(0),
  },
}));

import { preflight, recordSpend, budgetExceededError } from "../../lib/ai/budget/BudgetManager";
import { budgetStore } from "../../lib/ai/budget/budgetStore";
import { AiErrorCode } from "../../lib/ai/types/errors";
import { reloadAiEnv } from "../../lib/ai/config/env";

beforeEach(() => {
  budgetStore.readMonthly.mockResolvedValue(0);
  budgetStore.readDaily.mockResolvedValue(0);
  budgetStore.addMonthly.mockResolvedValue(0);
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  delete process.env.AI_BUDGET_GLOBAL_DAILY;
  delete process.env.AI_BUDGET_FEATURE_REPOSITORY_MONTHLY;
  reloadAiEnv();
});

describe("BudgetManager preflight", () => {
  it("allows when no caps configured", async () => {
    const d = await preflight({ feature: "repository", providerId: "groq" });
    expect(d.allowed).toBe(true);
  });

  it("denies when global monthly exceeded", async () => {
    process.env.AI_BUDGET_GLOBAL_MONTHLY = "10";
    reloadAiEnv();
    budgetStore.readMonthly.mockResolvedValue(11);
    const d = await preflight({ feature: "repository", providerId: "groq" });
    expect(d.allowed).toBe(false);
    expect(d.kind).toBe("global");
  });

  it("denies when feature monthly exceeded", async () => {
    process.env.AI_BUDGET_FEATURE_REPOSITORY_MONTHLY = "5";
    reloadAiEnv();
    budgetStore.readMonthly.mockImplementation(async (scope) =>
      String(scope).startsWith("feature:repository") ? 6 : 0
    );
    const d = await preflight({ feature: "repository", providerId: "groq" });
    expect(d.allowed).toBe(false);
    expect(d.kind).toBe("feature");
  });

  it("respects estimated cost in preflight", async () => {
    process.env.AI_BUDGET_GLOBAL_MONTHLY = "10";
    reloadAiEnv();
    budgetStore.readMonthly.mockResolvedValue(9.5);
    const d = await preflight({ feature: "repository", providerId: "groq", estCost: 1 });
    expect(d.allowed).toBe(false);
  });

  it("budgetExceededError returns AiError with BUDGET_EXCEEDED code", () => {
    const err = budgetExceededError({ kind: "global", period: "monthly", cap: 10, spent: 11 });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(AiErrorCode.BUDGET_EXCEEDED);
  });

  it("recordSpend no-ops on zero amount", async () => {
    const r = await recordSpend({ feature: "repository", providerId: "groq", amount: 0 });
    expect(r).toBe(null);
  });
});