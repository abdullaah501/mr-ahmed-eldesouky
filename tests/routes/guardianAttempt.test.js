import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashGuardianToken } from "../../lib/guardianToken";

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  submissionFindOne: vi.fn(),
  examFindById: vi.fn(),
  checkRouteRateLimit: vi.fn(),
  hydrateExams: vi.fn(),
  logSecurityEvent: vi.fn(),
  connectToDatabase: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data, init = {}) => ({
      _data: data,
      status: init.status || 200,
      headers: init.headers || {},
    }),
  },
}));

vi.mock("../../lib/connectToDb", () => ({
  default: (...a) => mocks.connectToDatabase(...a),
}));

vi.mock("../../lib/routeRateLimit", () => ({
  checkRouteRateLimit: (...a) => mocks.checkRouteRateLimit(...a),
}));

vi.mock("../../lib/securityLogger", () => ({
  logSecurityEvent: (...a) => mocks.logSecurityEvent(...a),
}));

vi.mock("../../lib/trace/index.js", () => ({
  withCaller: (_n, fn) => fn(),
  withTracePhase: (_p, fn) => fn(),
  withHttpTrace: (_req, _n, fn) => fn(),
}));

vi.mock("../../models/User", () => ({
  default: { findOne: (...a) => mocks.userFindOne(...a) },
}));

vi.mock("../../models/Submission", () => ({
  default: { findOne: (...a) => mocks.submissionFindOne(...a) },
}));

vi.mock("../../models/Exam", () => ({
  default: { findById: (...a) => mocks.examFindById(...a) },
}));

vi.mock("../../lib/questions/QuestionHydrator", () => ({
  hydrateExams: (...a) => mocks.hydrateExams(...a),
}));

import { GET } from "../../src/app/api/guardian/attempt/route.js";

const TOKEN = "a".repeat(64);
const OTHER_TOKEN = "b".repeat(64);
const STUDENT_A = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa" };
const STUDENT_B = { _id: "999999999999999999999999" };
const EXAM_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const QUESTION_ID = "cccccccccccccccccccccccc";
const GID = "dddddddddddddddddddddddd";

const EXAM_DOC = {
  _id: EXAM_ID,
  title: "Algebra",
  gradeId: GID,
  questionItems: [{ questionId: QUESTION_ID, order: 0, points: 1, required: true }],
};

const SUBMISSION = {
  score: { correct: 1, wrong: 0 },
  questionsAnswered: [
    { questionId: QUESTION_ID, type: "true-false", answer: "true", isCorrect: true },
  ],
  isCompleted: true,
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:05:00Z"),
};

function makeReq({ token = TOKEN, examId = EXAM_ID, extra = "" } = {}) {
  return {
    url: `https://x.com/api/guardian/attempt?examId=${examId}${extra}`,
    headers: {
      get: (name) => (name === "x-guardian-token" ? token : null),
    },
  };
}

function userChain(value) {
  return { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) };
}

function submissionChain(value) {
  return { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) };
}

function examChain(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

const noStore = (res) =>
  expect(res.headers["Cache-Control"]).toBe("private, no-store");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRouteRateLimit.mockResolvedValue(false);
  mocks.userFindOne.mockReturnValue(userChain(STUDENT_A));
  mocks.submissionFindOne.mockReturnValue(submissionChain(SUBMISSION));
  mocks.examFindById.mockReturnValue(examChain(EXAM_DOC));
  mocks.hydrateExams.mockImplementation(async (exams) =>
    exams.map((exam) => ({
      ...exam,
      questions: [{ _id: QUESTION_ID, type: "true-false", questionText: "Q1" }],
    }))
  );
});

describe("GET /api/guardian/attempt", () => {
  it("returns the exact {submission, exam} shape with no student key", async () => {
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(Object.keys(res._data.data).sort()).toEqual(["exam", "submission"]);
    expect(res._data.data.submission).toEqual(SUBMISSION);
    expect(res._data.data.exam).toEqual({
      _id: EXAM_ID,
      questions: [{ _id: QUESTION_ID, type: "true-false", questionText: "Q1" }],
    });
    expect(res._data.data.student).toBeUndefined();
    noStore(res);
  });

  it("binds identity to the token hash (never a client studentId)", async () => {
    await GET(makeReq());
    expect(mocks.userFindOne).toHaveBeenCalledWith({
      guardianTokenHash: hashGuardianToken(TOKEN),
      role: "student",
    });
  });

  it("ignores a supplied studentId and scopes the submission to the resolved student", async () => {
    const res = await GET(
      makeReq({ extra: `&studentId=${STUDENT_B._id}` })
    );

    expect(res.status).toBe(200);
    expect(mocks.submissionFindOne).toHaveBeenCalledWith({
      student: STUDENT_A._id,
      exam: EXAM_ID,
    });
  });

  it("prevents cross-child access for a different token", async () => {
    mocks.userFindOne.mockReturnValue(userChain(STUDENT_B));
    const res = await GET(
      makeReq({ token: OTHER_TOKEN, extra: `&studentId=${STUDENT_A._id}` })
    );

    expect(mocks.submissionFindOne).toHaveBeenCalledWith({
      student: STUDENT_B._id,
      exam: EXAM_ID,
    });
    expect(res.status).toBe(200);
  });

  it("returns a generic 404 when the token resolves to no student", async () => {
    mocks.userFindOne.mockReturnValue(userChain(null));
    const res = await GET(makeReq());

    expect(res.status).toBe(404);
    expect(res._data).toEqual({
      success: false,
      message: "Link is invalid or expired",
    });
    expect(mocks.submissionFindOne).not.toHaveBeenCalled();
    noStore(res);
  });

  it("rejects a malformed token before any DB lookup", async () => {
    const res = await GET(makeReq({ token: "not-a-valid-token" }));

    expect(res.status).toBe(404);
    expect(res._data.message).toBe("Link is invalid or expired");
    expect(mocks.userFindOne).not.toHaveBeenCalled();
    expect(mocks.connectToDatabase).not.toHaveBeenCalled();
    noStore(res);
  });

  it("rejects a missing token header before any DB lookup", async () => {
    const res = await GET(makeReq({ token: null }));

    expect(res.status).toBe(404);
    expect(mocks.userFindOne).not.toHaveBeenCalled();
    noStore(res);
  });

  it("returns 404 Attempt not found when the child has no submission", async () => {
    mocks.submissionFindOne.mockReturnValue(submissionChain(null));
    const res = await GET(makeReq());

    expect(res.status).toBe(404);
    expect(res._data).toEqual({
      success: false,
      message: "Attempt not found",
    });
    expect(mocks.examFindById).not.toHaveBeenCalled();
    noStore(res);
  });

  it("returns 404 Attempt not found for a malformed examId (no submission query)", async () => {
    const res = await GET(makeReq({ examId: "nope" }));

    expect(res.status).toBe(404);
    expect(res._data.message).toBe("Attempt not found");
    expect(mocks.submissionFindOne).not.toHaveBeenCalled();
    noStore(res);
  });

  it("returns exam: null when the exam was deleted but the submission exists", async () => {
    mocks.examFindById.mockReturnValue(examChain(null));
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(res._data.data.exam).toBeNull();
    expect(res._data.data.submission).toEqual(SUBMISSION);
    noStore(res);
  });

  it("hydrates questions server-side with exactly one hydrator call", async () => {
    await GET(makeReq());

    expect(mocks.hydrateExams).toHaveBeenCalledTimes(1);
    expect(mocks.hydrateExams).toHaveBeenCalledWith([EXAM_DOC]);
  });

  it("rate limits with 429 and no-store before any DB lookup", async () => {
    mocks.checkRouteRateLimit.mockResolvedValue(true);
    const res = await GET(makeReq());

    expect(res.status).toBe(429);
    expect(mocks.userFindOne).not.toHaveBeenCalled();
    expect(mocks.logSecurityEvent).toHaveBeenCalled();
    noStore(res);
  });

  it("never leaks student PII in the response body", async () => {
    const res = await GET(makeReq());
    const serialized = JSON.stringify(res._data);

    expect(res._data.data.student).toBeUndefined();
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain(STUDENT_A._id);
  });

  it("returns 500 with no-store when a DB read throws", async () => {
    mocks.userFindOne.mockImplementation(() => {
      throw new Error("db down");
    });
    const res = await GET(makeReq());

    expect(res.status).toBe(500);
    expect(res._data).toEqual({
      success: false,
      message: "Internal server error",
    });
    noStore(res);
  });
});
