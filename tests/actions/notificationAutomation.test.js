import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";

vi.mock("server-only", () => ({}));

// ── Shared fixtures ──────────────────────────────────────────────────────────
const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const GID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const LID = "cccccccccccccccccccccccc";
const EID = "dddddddddddddddddddddddd";
const SID = "eeeeeeeeeeeeeeeeeeeeeeee";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SECRET_ID = "test-secret";
});

// ── Module mocks (resolved to the same files the actions import) ─────────────
vi.mock("../../lib/checkUser", () => ({
  default: vi.fn(async () => ({ success: true, user: ADMIN })),
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn(async () => ({})),
}));

vi.mock("../../lib/video/recording", () => ({
  validateRecordingInput: (rec) => ({
    ok: true,
    recording: {
      provider: rec.provider,
      youtubeVideoId: "abc12345678",
      embedUrl: null,
      originalUrl: rec.url,
      title: null,
    },
  }),
}));

vi.mock("../../lib/services/gradeAuth", () => ({
  resolveGradeAccess: vi.fn(async () => ({ allowed: true, grant: {} })),
  isStaff: vi.fn(async () => true),
  getStaffedGradeIds: vi.fn(async () => [GID]),
}));

vi.mock("../../lib/services/notificationService", () => ({
  createNotification: vi.fn(async () => ({ _id: "n1" })),
  createNotificationsForGrade: vi.fn(async () => ({ inserted: 3 })),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  getNotificationTtlDays: vi.fn(() => 60),
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
    findById: vi.fn(() => ({
      select: () => ({ lean: async () => ({ name: "الصف العاشر" }) }),
    })),
  },
}));

vi.mock("../../models/Exam", () => ({
  default: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../lib/questions/examQuestionsService", () => ({
  createExamWithQuestions: vi.fn(async () => ({ _id: EID })),
  updateExamQuestions: vi.fn(async () => ({})),
  deleteExamCascade: vi.fn(),
}));

vi.mock("../../lib/questions/QuestionHydrator", () => ({
  hydrateExams: vi.fn(async (raws) => raws),
}));

vi.mock("../../models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../lib/validateOrigin", () => ({
  validateOrigin: vi.fn(() => null),
}));

vi.mock("../../lib/routeRateLimit", () => ({
  checkRouteRateLimit: vi.fn(async () => false),
}));

import { createNotificationsForGrade } from "../../lib/services/notificationService";
import Lecture from "../../models/Lecture";
import Exam from "../../models/Exam";
import User from "../../models/User";
import { createLecture, updateLecture, setLectureStatus } from "../../src/app/actions/lectureActions";
import { addExam, updateExam } from "../../src/app/actions/examActions";
import { TYPE_OPTIONS } from "../../src/app/components/notifications/NotificationsSection";
import { POST as composePOST } from "../../src/app/api/notifications/route";

const chain = (doc) => ({ select: () => ({ lean: async () => doc }) });
const flush = () => new Promise((r) => setTimeout(r, 0));

// Re-arm the factory defaults — resetAllMocks wipes implementations too,
// and fire-and-forget background tasks must never leak between tests.
function primeDefaults() {
  createNotificationsForGrade.mockResolvedValue({ inserted: 3 });
  Lecture.create.mockResolvedValue({
    _id: LID,
    title: "محاضرة",
    toObject: () => ({ _id: LID, title: "محاضرة" }),
  });
  Lecture.findById.mockReturnValue(chain({ gradeId: GID }));
  Lecture.findByIdAndUpdate.mockReturnValue({
    lean: async () => ({ _id: LID, title: "محاضرة", status: "published" }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  primeDefaults();
});

afterEach(() => {
  console.error.mockRestore();
});

describe("automatic lecture notifications", () => {
  it("createLecture (published) invokes the notification service without blocking the response", async () => {
    let resolveNotification;
    createNotificationsForGrade.mockImplementation(
      () => new Promise((resolve) => { resolveNotification = resolve; })
    );
    Lecture.create.mockResolvedValue({
      _id: LID,
      title: "محاضرة الكيمياء",
      toObject: () => ({ _id: LID, title: "محاضرة الكيمياء" }),
    });

    const res = await createLecture({ gradeId: GID, title: "محاضرة الكيمياء", publish: true });

    // The action returned successfully while fan-out was still pending.
    expect(res.success).toBe(true);
    expect(createNotificationsForGrade).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: GID, type: "new_lecture", title: "New lecture" })
    );
    resolveNotification({ inserted: 1 });
  });

  it("createLecture (draft) does not notify", async () => {
    Lecture.create.mockResolvedValue({
      _id: LID,
      title: "مسودة",
      toObject: () => ({ _id: LID, title: "مسودة" }),
    });

    const res = await createLecture({ gradeId: GID, title: "مسودة" });

    expect(res.success).toBe(true);
    expect(createNotificationsForGrade).not.toHaveBeenCalled();
  });

  it("notification failure does not fail lecture creation and is logged", async () => {
    createNotificationsForGrade.mockRejectedValue(new Error("fan-out boom"));
    Lecture.create.mockResolvedValue({
      _id: LID,
      title: "محاضرة",
      toObject: () => ({ _id: LID, title: "محاضرة" }),
    });

    const res = await createLecture({ gradeId: GID, title: "محاضرة", publish: true });

    expect(res.success).toBe(true);
    await flush();
    expect(console.error).toHaveBeenCalledWith(
      "new_lecture notification failed:",
      expect.any(Error)
    );
  });

  it("publish transition notifies; republished lecture does not duplicate", async () => {
    Lecture.findById.mockReturnValue(chain({ gradeId: GID, status: "draft", publishedAt: null }));
    Lecture.findByIdAndUpdate.mockReturnValue({ lean: async () => ({ _id: LID, title: "م", status: "published" }) });

    await setLectureStatus(LID, "published");
    expect(createNotificationsForGrade).toHaveBeenCalledTimes(1);
    expect(createNotificationsForGrade).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: GID, type: "new_lecture" })
    );

    vi.clearAllMocks();
    Lecture.findById.mockReturnValue(chain({ gradeId: GID, status: "published", publishedAt: new Date() }));
    Lecture.findByIdAndUpdate.mockReturnValue({ lean: async () => ({ _id: LID, title: "م", status: "published" }) });

    await setLectureStatus(LID, "published");
    expect(createNotificationsForGrade).not.toHaveBeenCalled();
  });

  it("content-only lecture update does not notify (existing publish/content distinction)", async () => {
    Lecture.findById.mockReturnValue(chain({ gradeId: GID }));

    await updateLecture({ lectureId: LID, title: "عنوان معدل" });

    expect(createNotificationsForGrade).not.toHaveBeenCalled();
  });
});

describe("automatic exam notifications", () => {
  it("addExam invokes the notification service without blocking the response", async () => {
    createNotificationsForGrade.mockImplementation(() => new Promise(() => {}));

    const res = await addExam({ gradeId: GID, title: "اختبار الوحدة", questions: [] });

    expect(res.success).toBe(true);
    expect(createNotificationsForGrade).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: GID, type: "new_exam", title: "New exam" })
    );
  });

  it("notification failure does not fail exam creation and is logged", async () => {
    createNotificationsForGrade.mockRejectedValue(new Error("fan-out boom"));

    const res = await addExam({ gradeId: GID, title: "اختبار", questions: [] });

    expect(res.success).toBe(true);
    await flush();
    expect(console.error).toHaveBeenCalledWith(
      "new_exam notification failed:",
      expect.any(Error)
    );
  });

  it("updateExam notifies once through a single authoritative trigger", async () => {
    Exam.findById
      .mockReturnValueOnce(chain({ gradeId: GID }))
      .mockReturnValueOnce(chain({ gradeId: GID, title: "اختبار الوحدة" }));

    const res = await updateExam({ examId: EID, questions: [] });

    expect(res.success).toBe(true);
    await flush();
    expect(createNotificationsForGrade).toHaveBeenCalledTimes(1);
    expect(createNotificationsForGrade).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: GID, type: "new_exam" })
    );
  });
});

describe("manual notification composer", () => {
  it("does not offer system-generated types for manual composition", () => {
    const values = TYPE_OPTIONS.map((t) => t.value);
    expect(values).not.toContain("new_lecture");
    expect(values).not.toContain("new_exam");
    expect(values).toContain("announcement");
  });
});

describe("targeted notification server validation", () => {
  const reqFor = (body) => ({
    url: "http://localhost:3000/api/notifications",
    json: async () => body,
  });

  it("rejects a forged studentId that does not resolve to a registered student", async () => {
    User.findById.mockReturnValue(chain(null));

    const res = await composePOST(
      reqFor({ audienceType: "user", studentId: SID, type: "announcement", title: "عنوان" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(createNotificationsForGrade).not.toHaveBeenCalled();
    const { createNotification } = await import("../../lib/services/notificationService");
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("delivers to a validated student", async () => {
    User.findById.mockReturnValue(chain({ role: "student" }));

    const res = await composePOST(
      reqFor({ audienceType: "user", studentId: SID, type: "announcement", title: "عنوان" })
    );

    expect(res.status).toBe(200);
    const { createNotification } = await import("../../lib/services/notificationService");
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: SID, type: "announcement" })
    );
  });

  it("grade targeting still works and system types remain valid server-side", async () => {
    const res = await composePOST(
      reqFor({ audienceType: "grade", gradeId: GID, type: "new_lecture", title: "عنوان" })
    );

    expect(res.status).toBe(200);
    expect(createNotificationsForGrade).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: GID, type: "new_lecture" })
    );
  });
});
