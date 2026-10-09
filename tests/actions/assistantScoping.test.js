import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const ASSISTANT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "assistant" };
const GID1 = "cccccccccccccccccccccccc";
const GID2 = "dddddddddddddddddddddddd";

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

const mockGetStaffedGradeIds = vi.fn();
vi.mock("../../lib/services/gradeAuth", () => ({
  getStaffedGradeIds: (...args) => mockGetStaffedGradeIds(...args),
  resolveGradeAccess: vi.fn(),
  isStaff: vi.fn(),
}));

const mockSearchQuestions = vi.fn();
const mockGetRepositoryStats = vi.fn();
vi.mock("../../lib/repository/questionService", () => ({
  searchQuestions: (...args) => mockSearchQuestions(...args),
  getQuestionById: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  softDeleteQuestion: vi.fn(),
  archiveQuestion: vi.fn(),
  restoreQuestion: vi.fn(),
  duplicateQuestion: vi.fn(),
  bulkDeleteQuestions: vi.fn(),
  bulkArchiveQuestions: vi.fn(),
  getRepositoryStats: (...args) => mockGetRepositoryStats(...args),
  getQuestionsByIds: vi.fn(),
}));

vi.mock("../../models/Grade", () => ({
  default: {
    find: vi.fn((filter) => {
      const ids = filter?._id?.$in || [];
      const rows = [];
      if (ids.includes(GID1)) rows.push({ name: "الصف السادس" });
      if (ids.includes(GID2)) rows.push({ name: "الصف الأول الإعدادي" });
      return {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(rows),
      };
    }),
  },
}));

vi.mock("../../lib/import/core/ImportEngine", () => ({
  ImportEngine: class {},
}));
vi.mock("../../lib/import/storage/fetchObject", () => ({
  getImportObject: vi.fn(),
}));
vi.mock("../../lib/import/storage/deleteObject", () => ({
  deleteImportObject: vi.fn(),
}));

import {
  searchRepositoryQuestions,
  getRepositoryStatsAction,
} from "../../src/app/actions/repositoryActions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchQuestions.mockResolvedValue({ items: [], nextCursor: null });
  mockGetRepositoryStats.mockResolvedValue({
    total: 0,
    byStatus: {},
    byType: {},
    bySource: {},
    byDifficulty: {},
  });
});

describe("assistant Question Bank grade scoping", () => {
  it("scopes an assistant's search to staffed grade NAMES (Question.grade contract)", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ASSISTANT });
    mockGetStaffedGradeIds.mockResolvedValue([GID1, GID2]);

    const res = await searchRepositoryQuestions({ subject: ["الرياضيات"] });

    expect(res.success).toBe(true);
    expect(mockGetStaffedGradeIds).toHaveBeenCalledWith(ASSISTANT._id);
    expect(mockSearchQuestions).toHaveBeenCalledTimes(1);
    const passed = mockSearchQuestions.mock.calls[0][0];
    // Staffed grade IDs resolve to Grade.name values — Question.grade is a
    // name string, so $in with raw IDs would match nothing.
    expect(passed.grade).toEqual(["الصف السادس", "الصف الأول الإعدادي"]);
    expect(passed.subject).toEqual(["الرياضيات"]);
    expect(passed.createdBy).toBeUndefined();
  });

  it("returns 200 + empty items when the assistant has no staffed grades", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ASSISTANT });
    mockGetStaffedGradeIds.mockResolvedValue([]);

    const res = await searchRepositoryQuestions({});

    expect(res.success).toBe(true);
    expect(res.items).toEqual([]);
    expect(res.nextCursor).toBeNull();
    expect(mockSearchQuestions).not.toHaveBeenCalled();
  });

  it("does not let an assistant inject arbitrary grade filters", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ASSISTANT });
    mockGetStaffedGradeIds.mockResolvedValue([GID1]);

    await searchRepositoryQuestions({ grade: ["999999999999999999999999"] });

    const passed = mockSearchQuestions.mock.calls[0][0];
    expect(passed.grade).toEqual(["الصف السادس"]);
  });

  it("admin searches pass through unchanged", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ADMIN });

    const params = { subject: ["الرياضيات"], createdBy: "x".repeat(24) };
    await searchRepositoryQuestions(params);

    expect(mockGetStaffedGradeIds).not.toHaveBeenCalled();
    const passed = mockSearchQuestions.mock.calls[0][0];
    expect(passed.subject).toEqual(["الرياضيات"]);
    expect(passed.createdBy).toBe("x".repeat(24));
  });
});

describe("assistant stats scope matches list scope", () => {
  it("scopes repository stats to staffed grade names for assistants", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ASSISTANT });
    mockGetStaffedGradeIds.mockResolvedValue([GID1, GID2]);
    mockGetRepositoryStats.mockResolvedValue({
      total: 5,
      byStatus: {},
      byType: {},
      bySource: {},
      byDifficulty: {},
    });

    const res = await getRepositoryStatsAction();

    expect(res.success).toBe(true);
    expect(res.stats.total).toBe(5);
    expect(mockGetRepositoryStats).toHaveBeenCalledWith({
      grade: ["الصف السادس", "الصف الأول الإعدادي"],
    });
  });

  it("assistant with no staffed grades gets a zeroed, consistent count", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ASSISTANT });
    mockGetStaffedGradeIds.mockResolvedValue([]);

    const res = await getRepositoryStatsAction();

    expect(res.success).toBe(true);
    expect(res.stats.total).toBe(0);
    expect(mockGetRepositoryStats).not.toHaveBeenCalled();
  });

  it("admin stats remain unscoped", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: ADMIN });
    mockGetRepositoryStats.mockResolvedValue({
      total: 47,
      byStatus: {},
      byType: {},
      bySource: {},
      byDifficulty: {},
    });

    const res = await getRepositoryStatsAction();

    expect(res.stats.total).toBe(47);
    expect(mockGetRepositoryStats).toHaveBeenCalledWith(undefined);
  });
});
