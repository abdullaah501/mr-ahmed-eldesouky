import { describe, it, expect, vi, beforeEach } from "vitest";
import Hashids from "hashids";

vi.mock("server-only", () => ({}));

const STUDENT = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ADMIN = "aaaaaaaaaaaaaaaaaaaaaaaa";
const GID = "cccccccccccccccccccccccc";
const EXAM = "111111111111111111111111";
const Q1 = "dddddddddddddddddddddddd";
const Q2 = "eeeeeeeeeeeeeeeeeeeeeeee";

const mockCheckUser = vi.fn();
vi.mock("../../lib/checkUser", () => ({
  default: (...args) => mockCheckUser(...args),
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn(async () => ({})),
}));

vi.mock("../../lib/trace/index.js", () => ({
  withCaller: (_name, fn) => fn(),
  withTracePhase: (_phase, fn) => fn(),
}));

const mockSession = {
  startTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  endSession: vi.fn(),
};
vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn(async () => mockSession),
  },
}));

const mockExamFindById = vi.fn();
vi.mock("../../models/Exam", () => ({
  default: { findById: (...args) => mockExamFindById(...args) },
}));

const mockGradeFindById = vi.fn();
vi.mock("../../models/Grade", () => ({
  default: { findById: (...args) => mockGradeFindById(...args) },
}));

const mockSubmissionCreate = vi.fn();
vi.mock("../../models/Submission", () => ({
  default: { create: (...args) => mockSubmissionCreate(...args) },
}));

const mockEssayCreate = vi.fn();
vi.mock("../../models/Essay", () => ({
  default: { create: (...args) => mockEssayCreate(...args) },
}));

const mockResolveGradeAccess = vi.fn();
const mockIsStaff = vi.fn();
const mockGetStaffedGradeIds = vi.fn();
vi.mock("../../lib/services/gradeAuth", () => ({
  resolveGradeAccess: (...args) => mockResolveGradeAccess(...args),
  isStaff: (...args) => mockIsStaff(...args),
  getStaffedGradeIds: (...args) => mockGetStaffedGradeIds(...args),
}));

vi.mock("../../lib/services/notificationService", () => ({
  createNotificationsForGrade: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("../../lib/questions/examQuestionsService", () => ({
  createExamWithQuestions: vi.fn(),
  updateExamQuestions: vi.fn(),
  deleteExamCascade: vi.fn(),
}));

const mockHydrateExams = vi.fn();
vi.mock("../../lib/questions/QuestionHydrator", () => ({
  hydrateExams: (...args) => mockHydrateExams(...args),
}));

const mockGetDraft = vi.fn();
const mockDeleteDraft = vi.fn();
const mockSaveDraft = vi.fn();
vi.mock("../../lib/services/quizDraftService", () => ({
  getDraft: (...args) => mockGetDraft(...args),
  deleteDraft: (...args) => mockDeleteDraft(...args),
  saveDraft: (...args) => mockSaveDraft(...args),
}));

import {
  addSubmission,
  getExam,
  saveQuizDraft,
} from "../../src/app/actions/examActions";

const RAW_EXAM = {
  _id: EXAM,
  gradeId: GID,
  title: "Exam",
  questionItems: [
    { questionId: Q1, order: 0 },
    { questionId: Q2, order: 1 },
  ],
};

function encodeExamId(id) {
  return new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10).encodeHex(id);
}

function mockExamChain(result) {
  return { select: () => ({ lean: async () => result }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.startTransaction.mockReset();
  mockResolveGradeAccess.mockResolvedValue({ allowed: true });
  mockIsStaff.mockResolvedValue(true);
});

describe("getExam draft integration", () => {
  it("returns the student's minimal draft alongside the exam", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    mockExamFindById.mockReturnValue({ lean: async () => RAW_EXAM });
    mockHydrateExams.mockResolvedValue([RAW_EXAM]);
    mockGradeFindById.mockReturnValue(mockExamChain({ name: "Grade" }));
    mockGetDraft.mockResolvedValue({ answers: { [Q1]: "a" }, revision: 3 });

    const result = await getExam(encodeExamId(EXAM));

    expect(result.success).toBe(true);
    expect(result.draft).toEqual({ answers: { [Q1]: "a" }, revision: 3 });
    expect(mockGetDraft).toHaveBeenCalledWith(STUDENT, EXAM);
  });

  it("does not pay for a draft query for admin/assistant callers", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: ADMIN, role: "admin" },
    });
    mockExamFindById.mockReturnValue({ lean: async () => RAW_EXAM });
    mockHydrateExams.mockResolvedValue([RAW_EXAM]);
    mockGradeFindById.mockReturnValue(mockExamChain({ name: "Grade" }));

    const result = await getExam(encodeExamId(EXAM));

    expect(result.draft).toBeNull();
    expect(mockGetDraft).not.toHaveBeenCalled();
  });
});

describe("addSubmission draft cleanup", () => {
  it("deletes the draft inside the submission transaction", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    mockExamFindById.mockReturnValue(
      mockExamChain({ _id: EXAM, gradeId: GID })
    );
    mockSubmissionCreate.mockResolvedValue([{ _id: "submission-1" }]);

    const result = await addSubmission({
      student: STUDENT,
      exam: EXAM,
      isCompleted: true,
      score: { correct: 1, wrong: 0 },
    });

    expect(result.success).toBe(true);
    expect(mockDeleteDraft).toHaveBeenCalledWith(STUDENT, EXAM, mockSession);
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });

  it("keeps the draft when the submission transaction aborts", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    mockExamFindById.mockReturnValue(
      mockExamChain({ _id: EXAM, gradeId: GID })
    );
    mockSubmissionCreate.mockResolvedValue([]);

    const result = await addSubmission({
      student: STUDENT,
      exam: EXAM,
      isCompleted: true,
    });

    expect(result.success).toBe(false);
    expect(mockDeleteDraft).not.toHaveBeenCalled();
    expect(mockSession.abortTransaction).toHaveBeenCalled();
  });
});

describe("saveQuizDraft", () => {
  function configureExam() {
    mockExamFindById.mockReturnValue(
      mockExamChain({
        gradeId: GID,
        questionItems: [{ questionId: Q1 }, { questionId: Q2 }],
      })
    );
  }

  it("rejects non-student callers", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: ADMIN, role: "admin" },
    });

    const result = await saveQuizDraft({
      examId: EXAM,
      baseRevision: 0,
      answers: {},
    });

    expect(result).toEqual({ success: false, message: "Unauthorized" });
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("rejects invalid ids and revisions", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });

    expect(
      (await saveQuizDraft({ examId: "bad", baseRevision: 0, answers: {} }))
        .success
    ).toBe(false);
    expect(
      (
        await saveQuizDraft({
          examId: EXAM,
          baseRevision: -1,
          answers: {},
        })
      ).success
    ).toBe(false);
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("enforces grade access before saving", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    configureExam();
    mockResolveGradeAccess.mockResolvedValue({ allowed: false });

    const result = await saveQuizDraft({
      examId: EXAM,
      baseRevision: 0,
      answers: { [Q1]: "a" },
    });

    expect(result.success).toBe(false);
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("sanitizes answers to the exam's question ids and maps a saved revision", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    configureExam();
    mockSaveDraft.mockResolvedValue({ status: "saved", revision: 2 });

    const result = await saveQuizDraft({
      examId: EXAM,
      baseRevision: 1,
      answers: { [Q1]: "a", stale: "x", [Q2]: 42 },
    });

    expect(result).toEqual({ success: true, revision: 2 });
    expect(mockSaveDraft).toHaveBeenCalledWith({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 1,
      answers: { [Q1]: "a" },
    });
  });

  it("returns the canonical draft on conflict", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    configureExam();
    mockSaveDraft.mockResolvedValue({
      status: "conflict",
      draft: { answers: { [Q1]: "server" }, revision: 4 },
    });

    const result = await saveQuizDraft({
      examId: EXAM,
      baseRevision: 2,
      answers: { [Q1]: "local" },
    });

    expect(result).toEqual({
      success: false,
      conflict: true,
      draft: { answers: { [Q1]: "server" }, revision: 4 },
    });
  });

  it("reports submitted status for late writes", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: STUDENT, role: "student", gradeId: GID },
    });
    configureExam();
    mockSaveDraft.mockResolvedValue({ status: "submitted" });

    const result = await saveQuizDraft({
      examId: EXAM,
      baseRevision: 3,
      answers: { [Q1]: "late" },
    });

    expect(result).toEqual({ success: true, submitted: true });
  });
});
