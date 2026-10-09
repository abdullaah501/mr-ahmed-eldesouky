import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../lib/ai/prompts";
import { renderPrompt, resolvePrompt } from "../../lib/ai/prompts/PromptManager";
import { listVersions } from "../../lib/ai/prompts/registry";

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

describe("prompt registry", () => {
  it("registers v1 and v2 for knowledge-extraction", async () => {
    expect(listVersions("knowledge-extraction").sort()).toEqual(["v1", "v2"]);
  });

  it("resolves v1 when AI_PROMPT_EXTRACTION=v1", async () => {
    const template = resolvePrompt("knowledge-extraction", { version: "v1" });
    expect(template.version).toBe("v1");
  });

  it("resolves v2 when version=v2", async () => {
    const template = resolvePrompt("knowledge-extraction", { version: "v2" });
    expect(template.version).toBe("v2");
  });

  it("renders system + user with interpolated vars", async () => {
    const out = await renderPrompt("knowledge-extraction", { text: "ABC", grade: "G1" }, { version: "v1" });
    expect(out.id).toBe("knowledge-extraction");
    expect(out.version).toBe("v1");
    expect(out.text.system).toBeTruthy();
    expect(out.text.user).toContain("ABC");
    expect(out.text.user).toContain("G1");
  });

  it("falls back to default var when missing", async () => {
    const out = await renderPrompt("knowledge-extraction", {}, { version: "v1" });
    expect(out.text.user).toContain(" غير محدد");
  });

  it("throws on unknown version", async () => {
    expect(() => resolvePrompt("knowledge-extraction", { version: "v99" })).toThrow();
  });

  it("includes optional focus hints for single-question regeneration", async () => {
    const { renderPrompt: render } = await import("../../lib/ai/prompts/PromptManager");
    const result = await render("question-generation", {
      structuredContext: { topics: ["algebra"] },
      questionCount: 1,
      focusIndex: 17,
      focusTopic: "linear equations",
    }, { version: "v1" });
    expect(result.text.system).toContain("focusIndex");
    expect(result.text.system).toContain("linear equations");
  });
});
