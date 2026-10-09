import { describe, expect, it, vi } from "vitest";
import { assertStructuredContext } from "../../lib/ai/workflows/knowledgeExtraction/schema/structuredContext";
import { normalizeStructuredContext } from "../../lib/ai/workflows/knowledgeExtraction/stages/aiExtractionStage";
import { buildGenerationCacheInput } from "../../lib/ai/workflows/questionGeneration/stages/aiQuestionGenerationStage";
import { clearWorkflowRunState, toError } from "../../src/hooks/useAiWorkflow";
import { aiEnv, reloadAiEnv } from "../../lib/ai/config/env";

describe("final AI generator stability fixes", () => {
  it("normalizes only semantically valid string list fields and rejects malformed objects", () => {
    const topics = ["المعادلات"];
    const normalized = normalizeStructuredContext({
      subject: "الرياضيات",
      concepts: "المعادلة الخطية",
      topics,
      objectives: null,
      formulas: { value: "x + 1" },
    });

    expect(normalized.concepts).toEqual(["المعادلة الخطية"]);
    expect(normalized.topics).toBe(topics);
    expect(normalized.objectives).toBeNull();
    expect(assertStructuredContext(normalized)).toEqual({
      ok: false,
      errors: ['Field "formulas" must be an array'],
    });
  });

  it("retains complete provider attribution while presenting a concise error", () => {
    const error = Object.assign(new Error("Groq HTTP 429: rate limited"), {
      code: "AI_RATE_LIMITED",
      extra: {
        requestedProvider: "google",
        requestedModel: "gemini-3.1-flash-lite",
        actualProvider: "groq",
        actualModel: "qwen/qwen3-32b",
        fallback: true,
        providersTried: [
          { id: "google", model: "gemini-3.1-flash-lite", success: false },
          { id: "groq", model: "qwen/qwen3-32b", success: false },
        ],
      },
    });
    const result = toError(error, {});

    expect(result.extra).toEqual(error.extra);
    expect(result.message).toContain("Requested provider: google/gemini-3.1-flash-lite");
    expect(result.message).toContain("Actual provider: groq/qwen/qwen3-32b");
    expect(result.message).toContain("Alternative providers were tried");
  });

  it("removes only non-semantic extraction metadata from generation cache input", () => {
    const context = {
      subject: "الرياضيات",
      topics: ["المعادلات"],
      _meta: {
        extractedAt: "2026-08-21T10:00:00.000Z",
        provider: "google",
        model: "gemini-3.1-flash-lite",
        promptId: "knowledge-extraction",
        promptVersion: "v2",
        schemaVersion: "1",
        lowConfidence: ["topics[0]"],
        overallConfidence: 0.8,
      },
    };
    const changedMetadata = buildGenerationCacheInput({
      ...context,
      _meta: { ...context._meta, extractedAt: "2026-08-22T10:00:00.000Z", provider: "groq" },
    });

    expect(buildGenerationCacheInput(context)).toEqual(changedMetadata);
    expect(changedMetadata._meta).toEqual({ lowConfidence: ["topics[0]"], overallConfidence: 0.8 });
    expect(changedMetadata.subject).toBe("الرياضيات");
    expect(changedMetadata.topics).toEqual(["المعادلات"]);
  });

  it("clears downstream run state without changing provider/model setters", () => {
    const names = [
      "setContext", "setContextArtifact", "setMissingFields", "setMissingInfoAnswers",
      "setGenerationParams", "setDraftQuestions", "setDraftArtifact", "setCanonicalJson",
      "setCanonicalArtifact", "setPreflightResult", "setImportReport", "setStageProgress",
      "setDebugMetadata", "setError", "setRequestId", "setUploadProgress",
      "setRegeneratingIndex", "setCancelled", "setStale",
    ];
    const setters = Object.fromEntries(names.map((name) => [name, vi.fn()]));

    clearWorkflowRunState(setters);

    expect(setters.setDraftQuestions).toHaveBeenCalledWith([]);
    expect(setters.setDraftArtifact).toHaveBeenCalledWith(null);
    expect(setters.setCanonicalJson).toHaveBeenCalledWith(null);
    expect(setters.setCanonicalArtifact).toHaveBeenCalledWith(null);
    expect(setters.setPreflightResult).toHaveBeenCalledWith(null);
    expect(setters.setImportReport).toHaveBeenCalledWith(null);
    expect(setters.setGenerationParams).toHaveBeenCalledWith({});
    expect(setters.setMissingInfoAnswers).toHaveBeenCalledWith({});
    expect(setters.setError).toHaveBeenCalledWith(null);
    expect(setters.setStageProgress).toHaveBeenCalledWith([]);
  });

  it("uses extraction v2 by default while preserving the v1 rollback", () => {
    const previous = process.env.AI_PROMPT_EXTRACTION;
    try {
      delete process.env.AI_PROMPT_EXTRACTION;
      expect(reloadAiEnv().promptSelection["knowledge-extraction"]).toBe("v2");
      process.env.AI_PROMPT_EXTRACTION = "v1";
      expect(reloadAiEnv().promptSelection["knowledge-extraction"]).toBe("v1");
    } finally {
      if (previous === undefined) delete process.env.AI_PROMPT_EXTRACTION;
      else process.env.AI_PROMPT_EXTRACTION = previous;
      reloadAiEnv();
    }
    expect(aiEnv().promptSelection["knowledge-extraction"]).toBe(previous || "v2");
  });
});
