import { describe, it, expect, vi } from "vitest";
import "../../lib/ai/prompts";
import {
  renderPrompt,
  resolvePrompt,
} from "../../lib/ai/prompts/PromptManager";
import { listVersions } from "../../lib/ai/prompts/registry";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { assertDraftQuestions } from "../../lib/ai/workflows/questionGeneration/schema/draftQuestions";
import { mapDraftQuestionToCanonical } from "../../lib/ai/workflows/canonicalJsonBuild/fieldMapping";
import { SUBJECTS } from "../../constants/subjects";
import { DIFFICULTY_LEVELS } from "../../constants/questionDifficulty";

const MOCK_GRADES = vi.hoisted(() => [
  "دورات أخرى",
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي",
]);

vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(MOCK_GRADES.map((name) => ({ name }))),
      }),
    }),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn().mockResolvedValue({}),
}));

const BASE_VARS = {
  structuredContext: {
    subject: "الرياضيات",
    grade: "الصف الأول الثانوي",
    language: "en",
    lessonTitle: "الجبر",
    topics: [{ value: "المعادلات", confidence: 0.9, sourceRanges: [] }],
  },
  grade: "الصف الأول الثانوي",
  subject: "الرياضيات",
  difficulty: "medium",
  questionCount: 5,
  questionTypes: [
    "multiple-choice",
    "true-false",
    "essay",
    "fill-blank",
    "matching",
  ],
  bloomLevel: "understand",
  focusTopic: "المعادلات",
};

async function renderV2(vars = {}) {
  return renderPrompt(
    "question-generation",
    { ...BASE_VARS, ...vars },
    { version: "v2" },
  );
}

describe("question-generation prompt versioning", () => {
  it("registers both v1 and v2", async () => {
    const versions = listVersions("question-generation");
    expect(versions).toContain("v1");
    expect(versions).toContain("v2");
  });

  it("resolvePrompt returns the exact requested version", async () => {
    expect(
      resolvePrompt("question-generation", { version: "v1" }).version,
    ).toBe("v1");
    expect(
      resolvePrompt("question-generation", { version: "v2" }).version,
    ).toBe("v2");
  });

  it("code default is v2 when env override is absent", async () => {
    const saved = process.env.AI_PROMPT_QUESTION_GENERATION;
    delete process.env.AI_PROMPT_QUESTION_GENERATION;
    try {
      expect(reloadAiEnv().promptSelection["question-generation"]).toBe("v2");
    } finally {
      if (saved === undefined) delete process.env.AI_PROMPT_QUESTION_GENERATION;
      else process.env.AI_PROMPT_QUESTION_GENERATION = saved;
      reloadAiEnv();
    }
  });

  it("v1 system text is unchanged (still the original Arabic role)", async () => {
    const v1 = await renderPrompt("question-generation", BASE_VARS, {
      version: "v1",
    });
    expect(v1.version).toBe("v1");
    expect(v1.text.system).toContain("أنت مولّد أسئلة تعليمية خبير");
    expect(v1.text.system).not.toContain("SYSTEM ROLE:");
    expect(v1.text.system).not.toContain("FORBIDDEN BEHAVIORS");
  });
});

describe("question-generation v2 prompt content", () => {
  it("renders v2 with system + user sections", async () => {
    const rendered = await renderV2();
    expect(rendered.version).toBe("v2");
    expect(rendered.text.system).toContain("SYSTEM ROLE:");
    expect(rendered.text.system).toContain(
      "INPUT CONTEXT (StructuredContext):",
    );
  });

  it("MCQ contract requires at least 4 options", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("at least 4");
    expect(system).toContain("optionText");
    expect(system).toContain("valueText");
    expect(system).toMatch(/correctAnswer is exactly one option's valueText/);
  });

  it("fill-blank contract requires options candidates and forbids config.answers", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("____");
    expect(system).toContain("stored in options");
    expect(system).toContain("do NOT use config.answers");
    expect(system).toContain("3 or 4 total candidates");
    expect(system).toContain("Exactly one candidate has isCorrect true");
    expect(system).toContain("plausible");
  });

  it("matching contract requires >= 4 pairs and forbids pairs in correctAnswer", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("minimum of 4");
    expect(system).toContain("leftItem");
    expect(system).toContain("rightItem");
    expect(system).toContain("do not put the pairs");
  });

  it("true-false contract forbids hedging and pins the canonical answer", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("sometimes");
    expect(system).toContain("usually");
    // Canonical machine-readable values are the lowercase strings "true"/"false".
    expect(system).toContain('lowercase string "true"');
    expect(system).toContain('lowercase string "false"');
    // The stale Arabic contract must not be requested anymore. Scoped to the
    // answer-contract sentence — Arabic question CONTENT examples stay allowed.
    expect(system).not.toContain('correctAnswer is exactly "صح"');
    expect(system).not.toContain('correctAnswer is exactly "خطأ"');
    expect(system).toContain("do not translate");
  });

  it("essay contract requires a non-empty model answer", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("correctAnswer is REQUIRED");
    expect(system).toContain("model answer");
    expect(system).toContain("Never output an empty correctAnswer");
    // The answer is content — language follows the content rules, not the
    // machine-readable enum rules.
    expect(system).toContain("strong student response");
  });

  it("v1 rollback prompt also pins canonical true-false and essay answers", async () => {
    const v1 = await renderPrompt("question-generation", BASE_VARS, { version: "v1" });
    expect(v1.text.system).toContain('"true" أو "false"');
    expect(v1.text.system).not.toContain('correctAnswer = "صح"');
    expect(v1.text.system).toContain("correctAnswer إلزامي");
    expect(v1.text.system).toContain("لا تتركها فارغة");
  });

  it("contains the question-type fitness check instruction", async () => {
    expect((await renderV2()).text.system).toContain(
      "QUESTION-TYPE FITNESS CHECK",
    );
  });

  it("forbids JSON contamination in learner-facing fields", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("FORBIDDEN BEHAVIORS");
    expect(system).toMatch(
      /questionText, correctAnswer, optionText, leftItem, rightItem, or explanation/,
    );
    expect(system).toMatch(/Never place raw JSON syntax/);
  });

  it("interpolates the canonical grade/subject/difficulty enum values", async () => {
    const { system } = (await renderV2()).text;
    for (const grade of MOCK_GRADES) expect(system).toContain(grade);
    for (const subject of SUBJECTS) expect(system).toContain(subject);
    for (const level of DIFFICULTY_LEVELS)
      expect(system).toContain(level.value);
    expect(system).toMatch(/Emit the English internal value only/);
  });

  it("contains content grounding and Arabic language rules", async () => {
    const { system } = (await renderV2()).text;
    expect(system).toContain("CONTENT GROUNDING RULES");
    expect(system).toContain("ARABIC LANGUAGE RULES");
    expect(system).toContain("RTL");
  });

  it("echoes generation parameters in the user message", async () => {
    const rendered = await renderV2({ questionCount: 7 });
    const { system } = rendered.text;
    expect(system).toContain("7");
    expect(system).toContain("GENERATION PARAMETERS:");
    expect(system).toContain("الرياضيات");
  });
});

describe("question-generation v2 fixture schema assertions", () => {
  const validQuestions = [
    {
      type: "multiple-choice",
      questionText: "ما ناتج 2+2؟",
      correctAnswer: "b",
      options: [
        { optionText: "3", valueText: "a" },
        { optionText: "4", valueText: "b" },
        { optionText: "5", valueText: "c" },
        { optionText: "6", valueText: "d" },
      ],
      difficulty: "easy",
    },
    { type: "true-false", questionText: "الأرض كروية.", correctAnswer: "صح" },
    { type: "essay", questionText: "اشرح قانون نيوتن الثاني.", correctAnswer: "قانون نيوتن الثاني: القوة = الكتلة × التسارع، مع شرح اتجاه القوة ومثال بسيط." },
    {
      type: "fill-blank",
      questionText: "ناتج 7×6 هو ____",
      correctAnswer: "42",
      options: [
        { id: "a1", text: "42", isCorrect: true },
        { id: "a2", text: "36", isCorrect: false },
        { id: "a3", text: "48", isCorrect: false },
      ],
      config: { caseSensitive: false },
    },
    {
      type: "matching",
      questionText: "وصل كل مصطلح بتعريفه.",
      config: {
        pairs: [
          { id: "p1", leftItem: "خلية", rightItem: "وحدة بناء الكائن الحي" },
          { id: "p2", leftItem: "ذرة", rightItem: "أصغر وحدة للعنصر" },
          { id: "p3", leftItem: "جزيء", rightItem: "اتحاد ذرتين أو أكثر" },
        ],
      },
    },
  ];

  it("accepts well-formed v2-style drafts of every type", async () => {
    const result = assertDraftQuestions(validQuestions);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects MCQ with fewer than 2 options (schema floor)", async () => {
    const result = assertDraftQuestions([

      {
        type: "multiple-choice",
        questionText: "س؟",
        correctAnswer: "a",
        options: [{ optionText: "1", valueText: "a" }],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("options");
  });

  it("rejects essay drafts without a model answer (AI output boundary)", async () => {
    const missing = assertDraftQuestions([{ type: "essay", questionText: "سؤال مقالي" }]);
    expect(missing.ok).toBe(false);
    expect(missing.errors.join(" ")).toContain("model answer");
    const blank = assertDraftQuestions([{ type: "essay", questionText: "سؤال مقالي", correctAnswer: "   " }]);
    expect(blank.ok).toBe(false);
    const complete = assertDraftQuestions([{ type: "essay", questionText: "سؤال مقالي", correctAnswer: "نموذج الإجابة" }]);
    expect(complete.ok).toBe(true);
  });

  it("rejects fill-blank without the ____ marker", async () => {
    const result = assertDraftQuestions([
      {
        type: "fill-blank",
        questionText: "أين الفراغ هنا؟",
        correctAnswer: "x",
        options: [
          { id: "a1", text: "x", isCorrect: true },
          { id: "a2", text: "y", isCorrect: false },
          { id: "a3", text: "z", isCorrect: false },
        ],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("____");
  });

  it("rejects fill-blank without exactly one isCorrect answer", async () => {
    const result = assertDraftQuestions([
      {
        type: "fill-blank",
        questionText: "اكتب ____",
        correctAnswer: "x",
        options: [
          { id: "a1", text: "x", isCorrect: true },
          { id: "a2", text: "y", isCorrect: true },
          { id: "a3", text: "z", isCorrect: false },
        ],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("isCorrect");
  });

  it("rejects matching with fewer than 2 pairs", async () => {
    const result = assertDraftQuestions([
      {
        type: "matching",
        questionText: "وصل.",
        config: { pairs: [{ id: "p1", leftItem: "أ", rightItem: "ب" }] },
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("pairs");
  });

  it("rejects unlisted types such as image-choice", async () => {
    const result = assertDraftQuestions([
      { type: "image-choice", questionText: "أي صورة؟" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("image-choice");
  });

  it("accepts a large set of MCQ fixtures with >= 4 options each", async () => {
    const mcqs = Array.from({ length: 20 }, (_, i) => ({
      type: "multiple-choice",
      questionText: `سؤال رقم ${i}؟`,
      correctAnswer: "a",
      options: ["a", "b", "c", "d"].map((v) => ({
        optionText: `خيار ${v}`,
        valueText: v,
      })),
    }));
    const result = assertDraftQuestions(mcqs);
    expect(result.ok).toBe(true);
  });
});

describe("canonical enum mapping (Wave 2 enum contract)", () => {
  const ctx = {
    context: { grade: "الصف الأول الثانوي", subject: "الرياضيات" },
    params: { difficulty: "medium" },
  };

  it("maps Arabic difficulty labels to the internal English value", async () => {
    const draft = {
      type: "essay",
      questionText: "س",
      correctAnswer: "",
      difficulty: "متوسط",
    };
    expect((await mapDraftQuestionToCanonical(draft, ctx)).difficulty).toBe(
      "medium",
    );
  });

  it("keeps internal difficulty values untouched", async () => {
    const draft = {
      type: "essay",
      questionText: "س",
      correctAnswer: "",
      difficulty: "hard",
    };
    expect((await mapDraftQuestionToCanonical(draft, ctx)).difficulty).toBe(
      "hard",
    );
  });

  it("resolves non-canonical draft grade to the canonical context grade", async () => {
    const draft = {
      type: "multiple-choice",
      questionText: "س",
      options: [],
      correctAnswer: "a",
      grade: "الأول الثانوي",
    };
    expect((await mapDraftQuestionToCanonical(draft, ctx)).grade).toBe(
      "الصف الأول الثانوي",
    );
  });

  it("preserves a subject that is already canonical", async () => {
    const draft = {
      type: "essay",
      questionText: "س",
      correctAnswer: "",
      subject: "الرياضيات",
    };
    expect((await mapDraftQuestionToCanonical(draft, ctx)).subject).toBe(
      "الرياضيات",
    );
  });

  it("defaults difficulty to medium when nothing is provided", async () => {
    const draft = { type: "essay", questionText: "س", correctAnswer: "" };
    expect((await mapDraftQuestionToCanonical(draft, ctx)).difficulty).toBe(
      "medium",
    );
  });
});
