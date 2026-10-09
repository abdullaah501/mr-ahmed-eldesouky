import { describe, it, expect } from "vitest";
import inspectStage from "../../lib/ai/workflows/missingInfoCollection/stages/inspectStage";
import buildCanonicalStage from "../../lib/ai/workflows/canonicalJsonBuild/stages/buildCanonicalStage";
import { wrapEnvelope } from "../../lib/ai/workflows/shared/envelope";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function runStageTwice(stage, makeCtx) {
  const ctx1 = makeCtx();
  const ctx2 = makeCtx();
  await stage.run(ctx1);
  await stage.run(ctx2);
  return { out1: JSON.stringify(ctx1.outputs), out2: JSON.stringify(ctx2.outputs) };
}

describe("statelessness — stages are pure functions of ctx", () => {
  it("inspectStage: identical fresh ctx → identical independent output", async () => {
    const makeCtx = () => ({
      inputs: { context: { subject: "math", grade: "g1" }, answers: null, generationParams: { questionCount: 5 } },
      outputs: {},
    });
    const { out1, out2 } = await runStageTwice(inspectStage, makeCtx);
    expect(out2).toBe(out1);
  });

  it("buildCanonicalStage: identical fresh ctx → identical canonical output (minus timestamps)", async () => {
    const draftArtifact = () => wrapEnvelope("draft-questions", "1", {
      questions: [{ type: "essay", questionText: "x" }],
    }, { taskId: "t1", provider: "p", model: "m", promptVersion: "v1", schemaVersion: "1" });

    const makeCtx = () => ({
      taskId: "t1",
      feature: "repository",
      provider: "p",
      model: "m",
      promptVersion: "v1",
      target: "repository",
      inputs: { draftArtifact: draftArtifact(), context: {}, generationParams: {}, userId: "u1" },
      outputs: {},
      artifacts: {},
    });

    const ctx1 = makeCtx();
    const ctx2 = makeCtx();
    await buildCanonicalStage.run(ctx1);
    await buildCanonicalStage.run(ctx2);

    const strip = (json) => {
      const copy = JSON.parse(JSON.stringify(json));
      if (copy.canonicalJson?._meta) delete copy.canonicalJson._meta.generatedAt;
      delete copy.canonicalArtifact;
      return JSON.stringify(copy);
    };
    expect(strip(ctx2.outputs)).toBe(strip(ctx1.outputs));
  });

  it("inspectStage does not leak answers across calls (no module-level state)", async () => {
    const ctx1 = { inputs: { context: { subject: "math", grade: "g1" }, answers: { difficulty: "easy", questionCount: 5, questionTypes: ["multiple-choice"] }, generationParams: {} }, outputs: {} };
    const ctx2 = { inputs: { context: { subject: "math", grade: "g1" }, answers: null, generationParams: {} }, outputs: {} };
    await inspectStage.run(ctx1);
    await inspectStage.run(ctx2);
    const missing1 = ctx1.outputs.missingFields.find((f) => f.key === "difficulty");
    const missing2 = ctx2.outputs.missingFields.find((f) => f.key === "difficulty");
    expect(missing1).toBeUndefined();
    expect(missing2).toBeDefined();
    expect(missing2.reason).toBe("absent");
  });
});