import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/ai/outputTargets", () => ({
  resolveOutputTarget: vi.fn(),
}));

import { ai } from "../../lib/ai/index.js";
import { resolveOutputTarget } from "../../lib/ai/outputTargets";
import { makeMockOutputTarget } from "./helpers/mockImportEngine";
import { wrapEnvelope } from "../../lib/ai/workflows/shared/envelope";

function makeCanonicalArtifact(questions) {
  return wrapEnvelope("canonical-json", "1", { questions, defaults: {}, _meta: {} }, { taskId: "t1", provider: "fake", model: "m", promptVersion: "v1", schemaVersion: "1" });
}

beforeEach(() => {
  resolveOutputTarget.mockReturnValue(makeMockOutputTarget({ id: "repository" }));
});

describe("repository-import workflow", () => {
  it("delegates to output target with {artifact, metadata, options}", async () => {
    const canonicalArtifact = makeCanonicalArtifact([{ type: "essay", questionText: "x" }]);
    const result = await ai({
      type: "repository-import",
      feature: "repository",
      canonicalArtifact,
      userId: "u1",
      requestId: "r1",
    });

    const target = resolveOutputTarget();
    expect(target._calls[0].artifact.type).toBe("canonical-json");
    expect(target._calls[0].metadata.userId).toBe("u1");
    expect(target._calls[0].options).toEqual({});
    expect(result.status).toBe("ok");
    expect(result.importResult.ok).toBe(true);
  });

  it("fails when output target returns ok:false", async () => {
    resolveOutputTarget.mockReturnValue(makeMockOutputTarget({ id: "repository", ok: false }));
    const result = await ai({
      type: "repository-import",
      feature: "repository",
      canonicalArtifact: makeCanonicalArtifact([]),
      userId: "u1",
    });
    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects non-canonical artifact", async () => {
    const badArtifact = wrapEnvelope("draft-questions", "1", {}, {});
    const result = await ai({
      type: "repository-import",
      feature: "repository",
      canonicalArtifact: badArtifact,
      userId: "u1",
    });
    expect(result.status).toBe("failed");
  });
});