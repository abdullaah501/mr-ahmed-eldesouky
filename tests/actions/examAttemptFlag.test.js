import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const STUDENT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "student" };
const ASSISTANT = { _id: "dddddddddddddddddddddddd", role: "assistant" };
const GID = "cccccccccccccccccccccccc";
const E1 = "111111111111111111111111";
const E2 = "222222222222222222222222";

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
  withHttpTrace: (_req, _name, fn) => fn(),
}));

const mockResolveGradeAccess = vi.fn();
const mockGetStaffedGradeIds = vi.fn();
vi.mock("../../lib/services/gradeAuth", () => ({
  resolveGradeAccess: (...args) => mockResolveGradeAccess(...args),
  isStaff: vi.fn(async () => true),
  getStaffedGradeIds: (...args) => mockGetStaffedGradeIds(...args),
}));

vi.mock("../../models/Exam", () => ({
  default: { find: vi.fn(), countDocuments: vi.fn() },
}));

const mockSubmissionFind = vi.fn();
vi.mock("../../models/Submission", () => ({
  default: { find: (...args) => mockSubmissionFind(...args) },
}));

vi.mock("../../models/Grade", () => ({
  default: { findById: vi.fn() },
}));

vi.mock("../../lib/questions/examQuestionsService", () => ({
  createExamWithQuestions: vi.fn(),
  updateExamQuestions: vi.fn(),
  deleteExamCascade: vi.fn(),
}));

vi.mock("../../lib/questions/QuestionHydrator", () => ({
  hydrateExams: vi.fn(async (raws) => raws),
}));

vi.mock("../../lib/services/notificationService", () => ({
  createNotification: vi.fn(),
  createNotificationsForGrade: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  getNotificationTtlDays: vi.fn(() => 60),
}));

vi.mock("../../lib/video/recording", () => ({
  validateRecordingInput: () => ({ ok: false, message: "unused" }),
}));

import { getExams } from "../../src/app/actions/examActions";
import Exam from "../../models/Exam";
import Submission from "../../models/Submission";

const EXAM_FIND_CHAIN = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue([
    { _id: E1, title: "اختبار 1", gradeId: GID },
    { _id: E2, title: "اختبار 2", gradeId: GID },
  ]),
};

function primeExams() {
  Exam.find.mockReturnValue(EXAM_FIND_CHAIN);
  Exam.countDocuments.mockResolvedValue(2);
}

const req = null; // getExams takes no request object

beforeEach(() => {
  vi.clearAllMocks();
  primeExams();
  mockResolveGradeAccess.mockResolvedValue({ allowed: true, grant: {} });
  mockGetStaffedGradeIds.mockResolvedValue([GID]);
  mockSubmissionFind.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  });
});

describe("student exam list attempt flag", () => {
  it("marks completed exams for the current student (hasAttempted=true)", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });
    mockSubmissionFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ exam: E1 }]),
    });

    const res = await getExams(GID);

    expect(res.success).toBe(true);
    expect(res.data.find((e) => e._id === E1).hasAttempted).toBe(true);
    expect(res.data.find((e) => e._id === E2).hasAttempted).toBe(false);
  });

  it("uses exactly ONE bounded current-user submission query (no N+1)", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    await getExams(GID);

    expect(mockSubmissionFind).toHaveBeenCalledTimes(1);
    const filter = mockSubmissionFind.mock.calls[0][0];
    expect(filter.student).toBe(STUDENT._id);
    expect(filter.exam).toEqual({ $in: [E1, E2] });
    expect(filter.isCompleted).toBe(true);
  });

  it("derives the student from the session only", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    await getExams(GID, { requestedStudentId: "999999999999999999999999" });

    const filter = mockSubmissionFind.mock.calls[0][0];
    expect(filter.student).toBe(STUDENT._id);
  });

  it("admins skip the attempt-flag query entirely", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ADMIN });

    const res = await getExams(GID);

    expect(res.success).toBe(true);
    expect(mockSubmissionFind).not.toHaveBeenCalled();
    expect(res.data.every((e) => e.hasAttempted === undefined)).toBe(true);
  });

  it("is bounded: default limit 50 and page/limit are honored", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    await getExams(GID);
    expect(EXAM_FIND_CHAIN.limit).toHaveBeenLastCalledWith(50);
    expect(EXAM_FIND_CHAIN.skip).toHaveBeenLastCalledWith(0);

    await getExams(GID, { page: 2, limit: 10 });
    expect(EXAM_FIND_CHAIN.limit).toHaveBeenLastCalledWith(10);
    expect(EXAM_FIND_CHAIN.skip).toHaveBeenLastCalledWith(10);

    await getExams(GID, { page: 1, limit: 500 });
    expect(EXAM_FIND_CHAIN.limit).toHaveBeenLastCalledWith(100);
  });

  it("returns pagination metadata", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await getExams(GID);

    expect(res.pagination).toEqual({ page: 1, limit: 50, total: 2 });
  });

  it("still blocks students from unauthorized grades", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });
    mockResolveGradeAccess.mockResolvedValue({ allowed: false, grant: null });

    const res = await getExams(GID);

    expect(res.success).toBe(false);
    expect(Exam.find).not.toHaveBeenCalled();
  });

  it("assistant non-staffed grade keeps the existing empty result", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ASSISTANT });
    mockGetStaffedGradeIds.mockResolvedValue(["999999999999999999999999"]);

    const res = await getExams(GID);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});
