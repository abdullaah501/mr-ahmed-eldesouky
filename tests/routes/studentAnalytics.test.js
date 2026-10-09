import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  checkUser: vi.fn(),
  getUserGradeIds: vi.fn(),
  gradeFind: vi.fn(),
  findSubmissions: vi.fn(),
  attendanceFind: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/checkUser", () => ({
  default: (...a) => mocks.checkUser(...a),
}));
vi.mock("../../lib/connectToDb", () => ({ default: vi.fn() }));
vi.mock("../../lib/services/gradeAuth", () => ({
  getUserGradeIds: (...a) => mocks.getUserGradeIds(...a),
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

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  }),
}));

vi.mock("../../models/Grade", () => ({
  default: { find: (...a) => mocks.gradeFind(...a) },
}));

vi.mock("../../models/Submission", () => ({
  default: {
    find: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mocks.findSubmissionsValue),
    })),
  },
}));

vi.mock("../../models/AttendanceRecord", () => ({
  default: { find: (...a) => mocks.attendanceFind(...a) },
}));

import { GET as studentAnalytics } from "../../src/app/api/student/analytics/route.js";

function makeRes(data) {
  return { success: true, data };
}

function gradeChain(rows) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkUser.mockResolvedValue({
    success: true,
    user: { _id: "u1", role: "student", gradeId: "g1" },
  });
  mocks.getUserGradeIds.mockResolvedValue([]);
  mocks.gradeFind.mockReturnValue(gradeChain([]));
  mocks.findSubmissionsValue = [];
  mocks.attendanceFind.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  });
});

function makeReq() {
  return { url: "https://x.com/api/student/analytics" };
}

describe("GET /api/student/analytics — grade-based overview", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.checkUser.mockResolvedValueOnce({ success: false });
    const res = await studentAnalytics(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns empty grades/attendance when the user has no gradeId", async () => {
    const res = await studentAnalytics(makeReq());
    const body = res._data;
    expect(body.success).toBe(true);
    expect(body.data.grades).toEqual([]);
    expect(body.data.attendance.percentage).toBeNull();
    expect(body.data.gradeSummary.totalExamsTaken).toBe(0);
  });

  it("resolves the student's profile Grade (no grants involved)", async () => {
    mocks.getUserGradeIds.mockResolvedValue(["g1"]);
    mocks.gradeFind.mockReturnValue(
      gradeChain([{ _id: "g1", name: "الصف الأول الثانوي" }])
    );
    const res = await studentAnalytics(makeReq());
    const body = res._data;
    expect(body.data.grades).toHaveLength(1);
    expect(body.data.grades[0].gradeId).toBe("g1");
    expect(body.data.grades[0].gradeName).toBe("الصف الأول الثانوي");
    expect(body.data.grades[0].enrolledAt).toBeNull();
  });

  it("computes gradeSummary from completed submissions", async () => {
    mocks.findSubmissionsValue = [
      { score: { correct: 7, wrong: 3 } },
      { score: { correct: 5, wrong: 5 } },
    ];
    const res = await studentAnalytics(makeReq());
    const body = res._data;
    expect(body.data.gradeSummary.totalExamsTaken).toBe(2);
    expect(body.data.gradeSummary.totalCorrect).toBe(12);
    expect(body.data.gradeSummary.totalWrong).toBe(8);
    expect(body.data.gradeSummary.averageScore).toBe(60);
  });

  it("computes attendance percentage (present+late count as attended)", async () => {
    mocks.attendanceFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          date: new Date("2026-03-01"),
          entries: [
            { studentId: "u1", status: "present" },
            { studentId: "other", status: "absent" },
          ],
        },
        {
          date: new Date("2026-03-08"),
          entries: [{ studentId: "u1", status: "late" }],
        },
        {
          date: new Date("2026-03-15"),
          entries: [{ studentId: "u1", status: "absent" }],
        },
        {
          date: new Date("2026-03-22"),
          entries: [{ studentId: "other", status: "present" }],
        },
      ]),
    });
    const res = await studentAnalytics(makeReq());
    const body = res._data;
    expect(body.data.attendance.total).toBe(3);
    expect(body.data.attendance.attended).toBe(2);
    expect(body.data.attendance.percentage).toBe(67);
  });
});
