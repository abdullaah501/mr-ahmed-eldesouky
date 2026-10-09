import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const STUDENT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "student" };
const GID = "cccccccccccccccccccccccc";
const UID = "dddddddddddddddddddddddd";
const LID = "eeeeeeeeeeeeeeeeeeeeeeee";

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
vi.mock("../../lib/services/gradeAuth", () => ({
  resolveGradeAccess: (...args) => mockResolveGradeAccess(...args),
  isStaff: vi.fn(async () => true),
  getStaffedGradeIds: vi.fn(async () => [GID]),
}));

vi.mock("../../lib/securityLogger", () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock("../../models/User", () => ({
  default: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../models/Lecture", () => ({
  default: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../models/Grade", () => ({
  default: {
    findById: vi.fn(() => ({ select: () => ({ lean: async () => ({ _id: GID }) }) })),
    find: vi.fn(() => ({
      select: () => ({ lean: async () => [{ _id: GID, name: "صف", active: true }] }),
    })),
  },
}));

vi.mock("../../models/GradeStaffAssignment", () => ({
  default: {
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../lib/video/recording", () => ({
  validateRecordingInput: () => ({ ok: false, message: "unused" }),
}));

import User from "../../models/User";
import Lecture from "../../models/Lecture";
import GradeStaffAssignment from "../../models/GradeStaffAssignment";
import {
  addStaffMember,
  removeStaffMember,
  getMyGradesForAssistant,
} from "../../src/app/actions/staffActions";
import { updateLecture } from "../../src/app/actions/lectureActions";
import { GET as getStudents } from "../../src/app/api/getStudents/route";

const chain = (doc) => ({ select: () => ({ lean: async () => doc }) });
const findChain = (rows) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckUser.mockResolvedValue({ success: true, user: ADMIN });
  mockResolveGradeAccess.mockResolvedValue({ allowed: true, grant: {} });
});

describe("assistant assignment (student promotion)", () => {
  it("promotes a student to assistant and creates the assignment", async () => {
    User.findOne.mockReturnValue(chain({ _id: UID, role: "student" }));
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });
    GradeStaffAssignment.create.mockResolvedValue({ _id: "a1" });

    const res = await addStaffMember({ assistantId: UID, gradeId: GID });

    expect(res.success).toBe(true);
    expect(res.message).toContain("User promoted to assistant");
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: UID },
      { $set: { role: "assistant" }, $inc: { tokenVersion: 1 } }
    );
    expect(GradeStaffAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ assistantId: UID, gradeId: GID })
    );
  });

  it("assigns an existing assistant without a role bump", async () => {
    User.findOne.mockReturnValue(chain({ _id: UID, role: "assistant" }));
    GradeStaffAssignment.create.mockResolvedValue({ _id: "a1" });

    const res = await addStaffMember({ assistantId: UID, gradeId: GID });

    expect(res.success).toBe(true);
    expect(res.message).toBe("Assigned");
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("rejects admin users server-side", async () => {
    User.findOne.mockReturnValue(chain(null));

    const res = await addStaffMember({ assistantId: UID, gradeId: GID });

    expect(res.success).toBe(false);
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(GradeStaffAssignment.create).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await addStaffMember({ assistantId: UID, gradeId: GID });

    expect(res.success).toBe(false);
    expect(User.findOne).not.toHaveBeenCalled();
  });
});

describe("registered-user search excluding admins", () => {
  const reqFor = (qs) => ({
    url: `http://localhost:3000/api/getStudents${qs}`,
    headers: { get: () => null },
  });

  it("excludeAdmins=1 queries role != admin server-side", async () => {
    User.countDocuments.mockResolvedValue(0);
    User.find.mockReturnValue(findChain([]));

    await getStudents(reqFor("?excludeAdmins=1&search="));

    expect(User.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ role: { $ne: "admin" } })
    );
  });

  it("default behavior (no flag) still searches students only", async () => {
    User.countDocuments.mockResolvedValue(0);
    User.find.mockReturnValue(findChain([]));

    await getStudents(reqFor("?search="));

    expect(User.countDocuments).toHaveBeenCalledWith({ role: "student" });
  });
});

describe("lecture scheduledFor handling (lecture domain)", () => {
  it("clearing scheduledFor persists a null patch", async () => {
    Lecture.findById.mockReturnValue(chain({ gradeId: GID }));
    Lecture.findByIdAndUpdate.mockReturnValue({
      lean: async () => ({ _id: LID, scheduledFor: null }),
    });

    const res = await updateLecture({ lectureId: LID, scheduledFor: null });

    expect(res.success).toBe(true);
    const [, patch] = Lecture.findByIdAndUpdate.mock.calls[0];
    expect(patch.scheduledFor).toBeNull();
  });
});

describe("assistant schedule access scoping", () => {
  it("assistants only see grades they are staffed on", async () => {
    mockCheckUser.mockResolvedValue({
      success: true,
      user: { _id: UID, role: "assistant" },
    });

    const res = await getMyGradesForAssistant();

    expect(res.success).toBe(true);
    expect(res.data.every((g) => g.active)).toBe(true);
  });
});

describe("assistant removal lifecycle", () => {
  function primeRemoval({ removed, remaining }) {
    GradeStaffAssignment.findByIdAndDelete.mockReturnValue({
      lean: vi.fn().mockResolvedValue(removed),
    });
    GradeStaffAssignment.countDocuments.mockResolvedValue(remaining);
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });
  }

  it("demotes to student when the LAST assignment is deleted", async () => {
    primeRemoval({ removed: { _id: "r1", assistantId: UID }, remaining: 0 });

    const res = await removeStaffMember("f1f1f1f1f1f1f1f1f1f1f1f1");

    expect(res.success).toBe(true);
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: UID },
      { $set: { role: "student" }, $inc: { tokenVersion: 1 } }
    );
  });

  it("keeps role assistant while other assignments remain", async () => {
    primeRemoval({ removed: { _id: "r2", assistantId: UID }, remaining: 2 });

    const res = await removeStaffMember("f1f1f1f1f1f1f1f1f1f1f1f1");

    expect(res.success).toBe(true);
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("deleting a nonexistent assignment changes no roles", async () => {
    primeRemoval({ removed: null, remaining: 0 });

    const res = await removeStaffMember("f1f1f1f1f1f1f1f1f1f1f1f1");

    expect(res.success).toBe(true);
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("non-admin callers cannot delete assignments", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await removeStaffMember("f1f1f1f1f1f1f1f1f1f1f1f1");

    expect(res.success).toBe(false);
    expect(GradeStaffAssignment.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
