import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  find: vi.fn(),
}));

vi.mock("../../models/Submission", () => ({
  default: {
    countDocuments: (...a) => mocks.countDocuments(...a),
    find: (...a) => mocks.find(...a),
  },
}));

import { getStudentExamResults } from "../../lib/studentAnalytics/examResultsService";

function findChain(rows) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStudentExamResults — examId exposure", () => {
  it("exposes the populated exam _id as examId", async () => {
    mocks.countDocuments.mockResolvedValue(1);
    mocks.find.mockReturnValue(
      findChain([
        {
          _id: "sub1",
          score: { correct: 3, wrong: 1 },
          isCompleted: true,
          createdAt: new Date("2026-01-02T10:00:00Z"),
          exam: {
            _id: "exam1",
            title: "Algebra Quiz",
            gradeId: { name: "Grade 10" },
          },
        },
      ])
    );

    const res = await getStudentExamResults({ studentId: "s1", page: 1, limit: 5 });

    expect(res.data).toHaveLength(1);
    expect(res.data[0].examId).toBe("exam1");
  });

  it("is null-safe when the populated exam is missing", async () => {
    mocks.countDocuments.mockResolvedValue(1);
    mocks.find.mockReturnValue(
      findChain([
        {
          _id: "sub2",
          score: { correct: 0, wrong: 0 },
          isCompleted: false,
          createdAt: new Date("2026-01-03T10:00:00Z"),
          exam: null,
        },
      ])
    );

    const res = await getStudentExamResults({ studentId: "s1" });

    expect(res.data[0].examId).toBeNull();
    expect(res.data[0].examTitle).toBe("");
    expect(res.data[0].gradeName).toBe("");
  });

  it("preserves all existing mapped fields and pagination", async () => {
    const createdAt = new Date("2026-01-04T10:00:00Z");
    mocks.countDocuments.mockResolvedValue(7);
    mocks.find.mockReturnValue(
      findChain([
        {
          _id: "sub3",
          score: { correct: 5, wrong: 2 },
          isCompleted: true,
          createdAt,
          exam: {
            _id: "exam3",
            title: "Geometry",
            gradeId: { name: "Grade 11" },
          },
        },
      ])
    );

    const res = await getStudentExamResults({ studentId: "s1", page: 2, limit: 2 });

    expect(res.data[0]).toEqual({
      _id: "sub3",
      examId: "exam3",
      score: { correct: 5, wrong: 2 },
      isCompleted: true,
      createdAt,
      courseId: null,
      lessonId: null,
      examTitle: "Geometry",
      gradeName: "Grade 11",
    });
    expect(res.pagination).toEqual({
      currentPage: 2,
      totalPages: 4,
      totalResults: 7,
      limit: 2,
    });
  });
});
