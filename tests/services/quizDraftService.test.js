import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const STUDENT = "aaaaaaaaaaaaaaaaaaaaaaaa";
const EXAM = "111111111111111111111111";

const mockFindOne = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockDeleteOne = vi.fn();
vi.mock("../../models/QuizDraft", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
    deleteOne: (...args) => mockDeleteOne(...args),
  },
}));

const mockExists = vi.fn();
vi.mock("../../models/Submission", () => ({
  default: { exists: (...args) => mockExists(...args) },
}));

import {
  deleteDraft,
  getDraft,
  hasSubmission,
  saveDraft,
} from "../../lib/services/quizDraftService";

function findOneChain(result) {
  return { select: () => ({ lean: async () => result }) };
}

function updateChain(result) {
  return { lean: async () => result };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExists.mockResolvedValue(null);
  mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
});

describe("quizDraftService", () => {
  it("reads only the minimal canonical fields by the unique key", async () => {
    mockFindOne.mockReturnValue(
      findOneChain({ answers: { q: "a" }, revision: 2 })
    );

    const draft = await getDraft(STUDENT, EXAM);

    expect(mockFindOne).toHaveBeenCalledWith({
      studentId: STUDENT,
      examId: EXAM,
    });
    expect(draft).toEqual({ answers: { q: "a" }, revision: 2 });
  });

  it("creates revision 1 for the first accepted sync (baseRevision 0)", async () => {
    mockFindOneAndUpdate.mockReturnValue(updateChain({ revision: 1 }));

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 0,
      answers: { q1: "a" },
    });

    expect(result).toEqual({ status: "saved", revision: 1 });
    const [filter, update, options] = mockFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ studentId: STUDENT, examId: EXAM, revision: 0 });
    expect(update).toEqual({ $set: { answers: { q1: "a" } }, $inc: { revision: 1 } });
    expect(options.upsert).toBe(true);
  });

  it("increments the stored revision strictly on a matching base", async () => {
    mockFindOneAndUpdate.mockReturnValue(updateChain({ revision: 8 }));

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 7,
      answers: { q1: "b" },
    });

    expect(result).toEqual({ status: "saved", revision: 8 });
    expect(mockFindOneAndUpdate.mock.calls[0][0]).toEqual({
      studentId: STUDENT,
      examId: EXAM,
      revision: 7,
    });
  });

  it("returns the canonical draft on a stale base revision without overwriting", async () => {
    mockFindOneAndUpdate.mockReturnValue(updateChain(null));
    mockFindOne.mockReturnValue(
      findOneChain({ answers: { q1: "server" }, revision: 5 })
    );

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 2,
      answers: { q1: "stale" },
    });

    expect(result.status).toBe("conflict");
    expect(result.draft).toEqual({ answers: { q1: "server" }, revision: 5 });
  });

  it("converts a duplicate-create race into a canonical conflict", async () => {
    mockFindOneAndUpdate.mockReturnValue({
      lean: () =>
        Promise.reject(Object.assign(new Error("duplicate"), { code: 11000 })),
    });
    mockFindOne.mockReturnValue(
      findOneChain({ answers: { q1: "winner" }, revision: 1 })
    );

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 0,
      answers: { q1: "loser" },
    });

    expect(result.status).toBe("conflict");
    expect(result.draft).toEqual({ answers: { q1: "winner" }, revision: 1 });
  });

  it("never recreates a draft after submission (pre-check)", async () => {
    mockExists.mockResolvedValue({ _id: "submission" });

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 0,
      answers: { q1: "late" },
    });

    expect(result).toEqual({ status: "submitted" });
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockDeleteOne).toHaveBeenCalledWith({
      studentId: STUDENT,
      examId: EXAM,
    });
  });

  it("closes the check/write window with a post-write submission guard", async () => {
    mockExists.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "s" });
    mockFindOneAndUpdate.mockReturnValue(updateChain({ revision: 1 }));

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 0,
      answers: { q1: "a" },
    });

    expect(result).toEqual({ status: "submitted" });
    expect(mockDeleteOne).toHaveBeenCalledTimes(1);
  });

  it("treats a vanished draft as submitted when a submission now exists", async () => {
    mockFindOneAndUpdate.mockReturnValue(updateChain(null));
    mockExists.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "s" });

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 3,
      answers: { q1: "a" },
    });

    expect(result).toEqual({ status: "submitted" });
  });

  it("returns conflict with a null draft when the row vanished without submission", async () => {
    mockFindOneAndUpdate.mockReturnValue(updateChain(null));
    mockFindOne.mockReturnValue(findOneChain(null));

    const result = await saveDraft({
      studentId: STUDENT,
      examId: EXAM,
      baseRevision: 3,
      answers: { q1: "a" },
    });

    expect(result).toEqual({ status: "conflict", draft: null });
  });

  it("passes the transaction session to draft deletion", async () => {
    const session = { id: "tx" };
    await deleteDraft(STUDENT, EXAM, session);
    expect(mockDeleteOne).toHaveBeenCalledWith(
      { studentId: STUDENT, examId: EXAM },
      { session }
    );
  });

  it("reports submission existence by student + exam", async () => {
    await hasSubmission(STUDENT, EXAM);
    expect(mockExists).toHaveBeenCalledWith({
      student: STUDENT,
      exam: EXAM,
    });
  });
});
