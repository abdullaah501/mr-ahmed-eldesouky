import { describe, it, expect, beforeEach, vi } from "vitest";

// Runtime grade source is the Grade collection â€” unit suites mock it.
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

vi.mock("../../lib/ai/outputTargets", () => ({
  resolveOutputTarget: vi.fn(),
}));

import { ai } from "../../lib/ai/index.js";
import { resolveOutputTarget } from "../../lib/ai/outputTargets";
import { makeMockOutputTarget } from "./helpers/mockImportEngine";
import { wrapEnvelope } from "../../lib/ai/workflows/shared/envelope";

function makeDraftArtifact(questions) {
  return wrapEnvelope("draft-questions", "1", { questions }, { taskId: "t1", provider: "fake", model: "fake-model", promptVersion: "v1", schemaVersion: "1" });
}

beforeEach(() => {
  resolveOutputTarget.mockReturnValue(makeMockOutputTarget({ id: "repository" }));
});

describe("canonical-json-build workflow", () => {
  it("builds canonical json and pre-flights via output target", async () => {
    const draftArtifact = makeDraftArtifact([
      { type: "multiple-choice", questionText: "x", correctAnswer: "a", options: [{ optionText: "x", valueText: "a" }, { optionText: "y", valueText: "b" }] },
    ]);
    const result = await ai({
      type: "canonical-json-build",
      feature: "repository",
      context: { subject: "math", grade: "g1" },
      generationParams: { difficulty: "easy", tags: [] },
      draftArtifact,
      userId: "u1",
    });

    expect(result.status).toBe("ok");
    expect(result.artifact.type).toBe("canonical-json");
    expect(result.artifact.parentId).toBe(draftArtifact.id);
    expect(result.canonicalJson.questions).toHaveLength(1);
    expect(result.canonicalJson._meta.generator).toBeDefined();
    expect(result.preflightOk).toBe(true);
  });

  it("per-question provenance is flat", async () => {
    const draftArtifact = makeDraftArtifact([{ type: "essay", questionText: "x" }]);
    const result = await ai({
      type: "canonical-json-build",
      feature: "repository",
      draftArtifact,
      userId: "u1",
    });
    const q = result.canonicalJson.questions[0];
    expect(q.aiPromptId).toBe("question-generation");
  });

  it("surfaces pre-flight errors when output target fails", async () => {
    resolveOutputTarget.mockReturnValue(makeMockOutputTarget({ id: "repository", ok: false }));
    const draftArtifact = makeDraftArtifact([{ type: "essay", questionText: "x" }]);
    const result = await ai({
      type: "canonical-json-build",
      feature: "repository",
      draftArtifact,
      userId: "u1",
    });
    expect(result.preflightOk).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});