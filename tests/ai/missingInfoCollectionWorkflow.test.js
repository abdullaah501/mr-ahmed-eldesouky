import { describe, it, expect, vi, beforeEach } from "vitest";
import { ai } from "../../lib/ai/index.js";
import { clearProviders, registerProvider } from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { makeFakeProvider } from "./helpers/fakeProvider";

// Runtime grade source is the Grade collection — unit suites mock it.
vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { name: "دورات أخرى" },
          { name: "الصف الأول الثانوي" },
          { name: "الصف الثاني الثانوي" },
          { name: "الصف الثالث الثانوي" },
        ]),
      }),
    }),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue({}),
}));

beforeEach(() => {
  clearProviders();
  resetAll();
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
});

describe("missing-info-collection workflow", () => {
  it("returns needs-input when required fields missing", async () => {
    const result = await ai({
      type: "missing-info-collection",
      feature: "repository",
      context: { subject: "math", grade: "g1" },
    });
    expect(result.status).toBe("needs-input");
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.artifact.type).toBe("missing-data-request");
    expect(result.artifact.parentId).toBeNull();
    expect(result.missingFields.some((f) => f.key === "questionCount" && f.required)).toBe(true);
  });

  it("returns complete when all required provided via answers", async () => {
    const result = await ai({
      type: "missing-info-collection",
      feature: "repository",
      context: { subject: "الرياضيات", grade: "الصف الأول الثانوي" },
      answers: { difficulty: "easy", questionCount: 5, questionTypes: ["multiple-choice"] },
    });
    expect(result.status).toBe("complete");
    expect(result.artifact.type).toBe("structured-context");
  });
});