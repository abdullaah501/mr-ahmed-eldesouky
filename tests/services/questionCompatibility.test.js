import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  gradeFindById: vi.fn(),
  questionFindByIdChain: vi.fn(),
}));

vi.mock("../../models/Grade", () => ({
  default: { findById: (...a) => mocks.gradeFindById(...a) },
}));

vi.mock("../../models/Question", () => ({
  default: {
    findById: (...a) => mocks.questionFindByIdChain(...a),
    create: vi.fn(async (docs) => docs),
  },
  // countDocuments used indirectly via Exam; not needed here
}));

vi.mock("../../models/Exam", () => ({
  default: {
    create: vi.fn(async (docs) => docs.map((d) => ({ ...d, _id: "exam-1", toObject: () => ({ ...d, _id: "exam-1" }) }))),
    countDocuments: vi.fn().mockResolvedValue(0),
    findOneAndDelete: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../../lib/connectToDb", () => ({ default: vi.fn() }));

// Fake transaction session — createExamWithQuestions wraps work in a session.
const fakeSession = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(async () => {}),
  abortTransaction: vi.fn(async () => {}),
  endSession: vi.fn(),
};
vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn(async () => fakeSession),
    Types: { ObjectId: class {} },
  },
}));

// Plugin registration side-effects import real plugin cores (pure) — fine.

import { createExamWithQuestions } from "../../lib/questions/examQuestionsService";

const GRADE = { _id: "g1", name: "الصف الأول الثانوي", active: true };

function gradeChain(result) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gradeFindById.mockReturnValue(gradeChain(GRADE));
});

describe("examQuestionsService — server-side question/grade compatibility enforcement", () => {
  it("accepts questions with empty grade metadata", async () => {
    const exam = await createExamWithQuestions({
      gradeId: "g1",
      title: "T",
      questions: [
        { type: "true-false", questionText: "Q1", correctAnswer: "صح" },
      ],
    });
    expect(exam.gradeId).toBe("g1");
    expect(mocks.gradeFindById).toHaveBeenCalled();
  });

  it("accepts questions whose grade equals the target grade name", async () => {
    const exam = await createExamWithQuestions({
      gradeId: "g1",
      questions: [
        { type: "true-false", questionText: "Q1", correctAnswer: "صح", grade: "الصف الأول الثانوي" },
      ],
    });
    expect(exam).toBeTruthy();
  });

  it("REJECTS a client-forged incompatible grade even when the UI is bypassed", async () => {
    await expect(
      createExamWithQuestions({
        gradeId: "g1",
        questions: [
          { type: "true-false", questionText: "bad", correctAnswer: "صح", grade: "الصف الثالث الثانوي" },
        ],
      })
    ).rejects.toThrow(/incompatible/);
  });

  it("rejects when the target grade does not exist or is inactive", async () => {
    mocks.gradeFindById.mockReturnValueOnce(gradeChain(null));
    await expect(
      createExamWithQuestions({ gradeId: "g1", questions: [{ type: "true-false", questionText: "q", correctAnswer: "صح" }] })
    ).rejects.toThrow("Grade not found");

    mocks.gradeFindById.mockReturnValueOnce(gradeChain({ ...GRADE, active: false }));
    await expect(
      createExamWithQuestions({ gradeId: "g1", questions: [{ type: "true-false", questionText: "q", correctAnswer: "صح" }] })
    ).rejects.toThrow("The grade is not active");
  });

  it("rejects empty question lists", async () => {
    await expect(createExamWithQuestions({ gradeId: "g1", questions: [] })).rejects.toThrow();
  });
});
