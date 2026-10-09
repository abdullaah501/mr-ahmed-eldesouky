import { beforeEach, describe, expect, it, vi } from "vitest";
import { ai } from "../../lib/ai";
import {
  clearProviders,
  registerProvider,
} from "../../lib/ai/providers/registry";
import { resetAll } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { buildKey } from "../../lib/ai/cache/extractionCache";
import { renderPrompt } from "../../lib/ai/prompts/PromptManager";
import {
  applyTeacherHints,
  normalizeTeacherHints,
} from "../../lib/ai/workflows/knowledgeExtraction/stages/aiExtractionStage";
import { toError } from "../../src/hooks/useAiWorkflow";
import { formatMissingInfoMessage } from "../../src/app/components/ai/MissingInfoForm";
import { makeFakeProvider } from "./helpers/fakeProvider";

// Missing-info collection sources grade options from the Grade collection.
vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue([
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
  reloadAiEnv();
});

describe("StructuredContext completeness flow", () => {
  it("allows structurally valid but incomplete extraction to reach MissingInfo", async () => {
    registerProvider(
      makeFakeProvider({ id: "fake", object: { concepts: ["المعادلات"] } }),
    );
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const extraction = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "شرح عن المعادلات",
      skipCache: true,
    });

    expect(extraction.status).toBe("ok");
    expect(extraction.context.concepts).toEqual(["المعادلات"]);
    expect(
      extraction.warnings.some(
        (warning) => warning.code === "AI_CONTEXT_INCOMPLETE",
      ),
    ).toBe(true);

    const missing = await ai({
      type: "missing-info-collection",
      feature: "repository",
      context: extraction.context,
      answers: {},
    });
    expect(missing.status).toBe("needs-input");
    expect(missing.missingFields.map((field) => field.key)).toContain(
      "subject",
    );
  });

  it("keeps malformed StructuredContext output fatal", async () => {
    registerProvider(
      makeFakeProvider({
        id: "fake",
        object: { subject: "الرياضيات", concepts: { value: "المعادلة" } },
      }),
    );
    process.env.AI_PROVIDER_ORDER = "fake";
    reloadAiEnv();

    const result = await ai({
      type: "knowledge-extraction",
      feature: "repository",
      input: "شرح",
      skipCache: true,
    });
    expect(result.status).toBe("failed");
    expect(
      result.errors.some((error) =>
        error.message.includes('Field "concepts" must be an array'),
      ),
    ).toBe(true);
  });
});

describe("Teacher metadata propagation", () => {
  it("uses only non-empty hints and gives them precedence over null extraction values", async () => {
    const hints = normalizeTeacherHints({
      subject: " الرياضيات ",
      grade: "الصف الأول الثانوي",
      lessonTitle: " المعادلات ",
      language: "",
    });
    expect(hints).toEqual({
      subject: "الرياضيات",
      grade: "الصف الأول الثانوي",
      lessonTitle: "المعادلات",
    });
    expect(
      applyTeacherHints(
        { subject: null, grade: null, lessonTitle: "", topics: ["المعادلات"] },
        hints,
      ),
    ).toEqual({
      subject: "الرياضيات",
      grade: "الصف الأول الثانوي",
      lessonTitle: "المعادلات",
      topics: ["المعادلات"],
    });
  });

  it("renders subject, grade, and lessonTitle in the active extraction prompt", async () => {
    const rendered = await renderPrompt(
      "knowledge-extraction",
      {
        subject: "الرياضيات",
        grade: "الصف الأول الثانوي",
        lessonTitle: "المعادلات",
        language: "en",
        text: "نص الدرس",
      },
      { version: "v2" },
    );
    expect(rendered.text.user).toContain("المادة: الرياضيات");
    expect(rendered.text.user).toContain("الصف: الصف الأول الثانوي");
    expect(rendered.text.user).toContain("عنوان الدرس: المعادلات");
  });
});

describe("MissingInfo and extraction cache identity", () => {
  it("merges teacher answers and reports the remaining fields", async () => {
    const result = await ai({
      type: "missing-info-collection",
      feature: "repository",
      context: { lessonTitle: "المعادلات" },
      answers: {
        subject: "الرياضيات",
        grade: "الصف الأول الثانوي",
        difficulty: "easy",
        questionCount: 5,
        questionTypes: ["multiple-choice"],
      },
    });
    expect(result.status).toBe("complete");
    expect(result.context.subject).toBe("الرياضيات");
    expect(result.context.grade).toBe("الصف الأول الثانوي");
    expect(result.generationParams.difficulty).toBe("easy");
  });

  it("differentiates extraction cache identities by meaningful teacher hints", async () => {
    const base = {
      normalizedInput: "same-file-text",
      promptId: "knowledge-extraction",
      promptVersion: "v2",
      schemaId: "structured-context",
      schemaVersion: "1",
      providerId: "google",
      modelId: "gemini-model",
      capabilityProfile: { structuredOutput: true },
    };
    const mathKey = buildKey({
      ...base,
      extra: { hints: { subject: "الرياضيات" } },
    }).key;
    const physicsKey = buildKey({
      ...base,
      extra: { hints: { subject: "الفيزياء" } },
    }).key;
    expect(mathKey).not.toBe(physicsKey);
  });

  it("builds the clarification message from missingFields labels", async () => {
    const message = formatMissingInfoMessage([
      { key: "subject", label: "Subject" },
      { key: "lessonTitle", label: "Lesson title" },
    ]);
    expect(message).toContain("Questions can't be generated yet.");
    expect(message).toContain("• Subject");
    expect(message).toContain("• Lesson title");
    expect(message).not.toContain("• Topic");
  });

  it("keeps structural error details available while using English UI text", async () => {
    const error = toError(
      {
        code: "AI_ASSERTION_FAILED",
        message: 'Field "concepts" must be an array',
      },
      {},
    );
    expect(error.message).toContain("Could not parse the content extracted");
    expect(error.extra.internalMessage).toContain("concepts");
  });
});
