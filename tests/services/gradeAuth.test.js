import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../models/User", () => ({
  default: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../models/Grade", () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../../models/GradeStaffAssignment", () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

import User from "../../models/User";
import Grade from "../../models/Grade";
import GradeStaffAssignment from "../../models/GradeStaffAssignment";
import {
  resolveGradeAccess,
  getUserGradeIds,
  getStudentIdsForGrade,
  isStaff,
  getStaffedGradeIds,
} from "../../lib/services/gradeAuth";

function userChain(doc) {
  return { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(doc) };
}

describe("gradeAuth — resolveGradeAccess (User.gradeId based)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies when the user has no gradeId (no throw, graceful)", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: null }));
    const res = await resolveGradeAccess({ userId: "u1", gradeId: "g1" });
    expect(res.allowed).toBe(false);
    expect(res.grade).toBeNull();
  });

  it("denies when the requested gradeId mismatches the user's gradeId (no Grade query)", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    const res = await resolveGradeAccess({
      userId: "u1",
      gradeId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(res.allowed).toBe(false);
    expect(Grade.findOne).not.toHaveBeenCalled();
  });

  it("denies when the user's Grade is inactive", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    Grade.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    const res = await resolveGradeAccess({
      userId: "u1",
      gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(res.allowed).toBe(false);
  });

  it("allows when the requested gradeId equals the user's active profile Grade", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    Grade.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
        name: "الصف الأول الثانوي",
      }),
    });
    const res = await resolveGradeAccess({
      userId: "u1",
      gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(res.allowed).toBe(true);
    expect(res.grade.name).toBe("الصف الأول الثانوي");
  });

  it("uses a trusted caller-provided userGradeId without loading the User", async () => {
    const res = await resolveGradeAccess({
      userId: "u1",
      gradeId: "cccccccccccccccccccccccc",
      userGradeId: "dddddddddddddddddddddddd",
    });
    expect(res.allowed).toBe(false);
    expect(User.findById).not.toHaveBeenCalled();
  });
});

describe("gradeAuth — getUserGradeIds (profile Grade resolution)", () => {
  it("returns [] when the user has no gradeId", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: null }));
    expect(await getUserGradeIds("u1")).toEqual([]);
  });

  it("returns [] when the profile Grade is missing or inactive", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    Grade.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    expect(await getUserGradeIds("u1")).toEqual([]);
  });

  it("returns exactly one id — the profile Grade", async () => {
    User.findById.mockReturnValueOnce(userChain({ _id: "u1", gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    Grade.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa" }),
    });
    expect(await getUserGradeIds("u1")).toEqual(["aaaaaaaaaaaaaaaaaaaaaaaa"]);
  });
});

describe("gradeAuth — getStudentIdsForGrade (roster / fan-out)", () => {
  it("returns [] for an unknown grade", async () => {
    Grade.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    expect(await getStudentIdsForGrade("g1")).toEqual([]);
  });

  it("returns [] for an inactive grade", async () => {
    Grade.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "g1", active: false }),
    });
    expect(await getStudentIdsForGrade("g1")).toEqual([]);
  });

  it("returns only student users assigned to the grade", async () => {
    Grade.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "g1", active: true }),
    });
    User.find.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: "s1" }, { _id: "s2" }]),
    });
    const ids = await getStudentIdsForGrade("g1");
    expect(ids).toEqual(["s1", "s2"]);
    expect(User.find).toHaveBeenCalledWith({ role: "student", gradeId: "g1" });
  });
});

describe("gradeAuth — assistant staff checks (unchanged)", () => {
  it("staff checks are GradeStaffAssignment-row based", async () => {
    GradeStaffAssignment.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "x" }),
    });
    expect(await isStaff("a1", "g1")).toBe(true);
    GradeStaffAssignment.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    expect(await isStaff("a2", "g2")).toBe(false);
    GradeStaffAssignment.find.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ gradeId: "g1" }, { gradeId: "g3" }]),
    });
    expect(await getStaffedGradeIds("a1")).toEqual(["g1", "g3"]);
  });
});
