import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const STUDENT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "student" };
const GID = "cccccccccccccccccccccccc";
const UID = "dddddddddddddddddddddddd";
const EID = "eeeeeeeeeeeeeeeeeeeeeeee";

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

vi.mock("../../models/ScheduleEvent", () => ({
  default: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../lib/video/recording", () => ({
  validateRecordingInput: () => ({ ok: false, message: "unused" }),
}));

import ScheduleEvent from "../../models/ScheduleEvent";
import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  listScheduleEventsForStaff,
  getScheduleForStudent,
} from "../../src/app/actions/scheduleActions";

// Independent Cairo wall-clock reader (test-side oracle via Intl only).
function cairoWall(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(date).map((x) => [x.type, x.value])
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${String(parseInt(p.hour, 10) % 24).padStart(2, "0")}:${p.minute}`,
    weekday: p.weekday,
  };
}

const chain = (doc) => ({ select: () => ({ lean: async () => doc }) });
const findByIdChain = (doc) => ({ lean: async () => doc });

function createdDoc(overrides = {}) {
  const doc = {
    _id: EID,
    gradeId: GID,
    title: "مراجعة نهائية",
    startAt: new Date("2026-09-03T16:00:00Z"),
    endAt: new Date("2026-09-03T17:00:00Z"),
    mode: "online",
    location: { name: "", address: "" },
    onlineUrl: "https://meet.example.com/x",
    recurrence: { type: "once" },
    createdBy: UID,
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
  return doc;
}

const VALID_INPUT = {
  gradeId: GID,
  title: "حصة رياضيات",
  date: "2026-09-07",
  startTime: "18:00",
  endTime: "19:00",
  mode: "offline",
  locationName: "السنتر",
  locationAddress: "المدينة",
  weekly: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckUser.mockResolvedValue({ success: true, user: ADMIN });
  mockResolveGradeAccess.mockResolvedValue({ allowed: true, grant: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Egypt timezone handling", () => {
  it("stores 18:00 winter Cairo as 16:00 UTC (UTC+2)", async () => {
    ScheduleEvent.create.mockImplementation(async (doc) => createdDoc(doc));

    const res = await createScheduleEvent({
      ...VALID_INPUT,
      date: "2026-01-05", // Egypt winter time (UTC+2)
      startTime: "18:00",
      endTime: "19:00",
    });

    expect(res.success).toBe(true);
    const stored = ScheduleEvent.create.mock.calls[0][0];
    expect(stored.startAt.getTime()).toBe(Date.UTC(2026, 0, 5, 16, 0));
    expect(stored.endAt.getTime()).toBe(Date.UTC(2026, 0, 5, 17, 0));
  });

  it("stores 18:00 summer Cairo as 15:00 UTC (UTC+3, DST)", async () => {
    ScheduleEvent.create.mockImplementation(async (doc) => createdDoc(doc));

    const res = await createScheduleEvent({
      ...VALID_INPUT,
      date: "2026-07-06", // Egypt summer time (UTC+3)
      startTime: "18:00",
      endTime: null,
    });

    expect(res.success).toBe(true);
    const stored = ScheduleEvent.create.mock.calls[0][0];
    expect(stored.startAt.getTime()).toBe(Date.UTC(2026, 6, 6, 15, 0));
  });

  it("rejects endTime earlier than startTime", async () => {
    const res = await createScheduleEvent({
      ...VALID_INPUT,
      startTime: "19:00",
      endTime: "18:00",
    });

    expect(res.success).toBe(false);
    expect(ScheduleEvent.create).not.toHaveBeenCalled();
  });

  it("round-trips 18:00 Cairo storage back to 18:00 Cairo wall-clock", async () => {
    ScheduleEvent.create.mockImplementation(async (doc) => createdDoc(doc));

    await createScheduleEvent({
      ...VALID_INPUT,
      date: "2026-03-02",
      startTime: "18:00",
      endTime: null,
    });

    const stored = ScheduleEvent.create.mock.calls[0][0];
    const wall = cairoWall(stored.startAt);
    expect(wall.date).toBe("2026-03-02");
    expect(wall.time).toBe("18:00");
  });
});

describe("schedule domain separation", () => {
  it("scheduleActions never touches the Lecture or Live domains", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      new URL("../../src/app/actions/scheduleActions.js", import.meta.url),
      "utf8"
    );
    expect(source).not.toContain("Lecture");
    expect(source).not.toContain("createLecture");
    expect(source).not.toContain("Live");
  });
});

describe("student schedule (ScheduleEvent occurrences)", () => {
  function setEvents(events) {
    ScheduleEvent.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(events),
    });
  }

  it("rejects unauthorized grades server-side", async () => {
    mockResolveGradeAccess.mockResolvedValue({ allowed: false, grant: null });
    setEvents([]);

    const res = await getScheduleForStudent(GID);

    expect(res.success).toBe(false);
  });

  it("keeps an in-progress one-time event visible until endAt", async () => {
    // Wednesday 2026-09-09 18:30 Cairo = 15:30 UTC (summer, UTC+3)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T15:30:00Z"));

    setEvents([
      createdDoc({
        _id: "once1",
        title: "مراجعة نهائية",
        startAt: new Date("2026-09-09T15:00:00Z"), // 18:00 Cairo
        endAt: new Date("2026-09-09T16:00:00Z"), // 19:00 Cairo
        recurrence: { type: "once" },
      }),
    ]);

    const res = await getScheduleForStudent(GID);

    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("مراجعة نهائية");
    expect(res.data[0].startAt).toBe("2026-09-09T15:00:00.000Z");
  });

  it("hides a one-time event after endAt passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T16:01:00Z")); // 19:01 Cairo

    setEvents([
      createdDoc({
        _id: "once2",
        startAt: new Date("2026-09-09T15:00:00Z"),
        endAt: new Date("2026-09-09T16:00:00Z"),
        recurrence: { type: "once" },
      }),
    ]);

    const res = await getScheduleForStudent(GID);

    expect(res.data).toHaveLength(0);
  });

  it("follows the startAt rule for events without endAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T15:30:00Z"));

    setEvents([
      createdDoc({
        _id: "noend-current",
        startAt: new Date("2026-09-09T15:00:00Z"), // started, no endAt
        endAt: null,
        recurrence: { type: "once" },
      }),
      createdDoc({
        _id: "noend-future",
        startAt: new Date("2026-09-10T15:00:00Z"),
        endAt: null,
        recurrence: { type: "once" },
      }),
    ]);

    const res = await getScheduleForStudent(GID);

    // Started-but-ongoing without endAt: hidden (startAt >= now is the rule)
    expect(res.data.map((o) => o.eventId)).toEqual(["noend-future"]);
  });

  it("expands a weekly rule into 8 weekly occurrences without materialization", async () => {
    // Wednesday 2026-09-09 — a weekly "every Thursday" rule started earlier.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));

    // 2026-09-10 is a Thursday; 18:00 Cairo summer = 15:00 UTC
    setEvents([
      createdDoc({
        _id: "weekly1",
        title: "حصة رياضيات",
        startAt: new Date("2026-07-02T15:00:00Z"), // first Thursday of the rule
        endAt: new Date("2026-07-02T16:00:00Z"),
        recurrence: { type: "weekly" },
      }),
    ]);

    const res = await getScheduleForStudent(GID);

    expect(res.success).toBe(true);
    // Window: Sep 9 → +56 Cairo days (Nov 4). Thursdays: Sep 10, 17, 24,
    // Oct 1, 8, 15, 22, 29 = 8 occurrences.
    expect(res.data).toHaveLength(8);
    for (const occ of res.data) {
      const wall = cairoWall(new Date(occ.startAt));
      expect(wall.weekday).toBe("Thu");
      expect(wall.time).toBe("18:00");
      expect(occ.endAt).not.toBeNull();
    }
    // Exactly one MongoDB query backs the whole series (the rule itself).
    expect(ScheduleEvent.find).toHaveBeenCalledTimes(1);
  });

  it("shows the current weekly occurrence while in progress", async () => {
    // Thursday 2026-09-10 18:30 Cairo = 15:30 UTC — inside 18:00→19:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:30:00Z"));

    setEvents([
      createdDoc({
        _id: "weekly2",
        startAt: new Date("2026-07-02T15:00:00Z"),
        endAt: new Date("2026-07-02T16:00:00Z"),
        recurrence: { type: "weekly" },
      }),
    ]);

    const res = await getScheduleForStudent(GID);

    const startTimes = res.data.map((o) => o.startAt);
    expect(startTimes).toContain("2026-09-10T15:00:00.000Z");
  });

  it("does not permanently mutate the weekly rule after an occurrence ends", async () => {
    vi.useFakeTimers();
    // Friday 2026-09-11 — the Thursday rule's Sep 10 occurrence has ended.
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"));

    const rule = createdDoc({
      _id: "weekly3",
      startAt: new Date("2026-07-02T15:00:00Z"),
      endAt: new Date("2026-07-02T16:00:00Z"),
      recurrence: { type: "weekly" },
    });
    setEvents([rule]);

    const res = await getScheduleForStudent(GID);

    // Future Thursdays still generated from the untouched rule.
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((o) => o.eventId === "weekly3")).toBe(true);
    expect(cairoWall(new Date(res.data[0].startAt)).weekday).toBe("Thu");
  });

  it("sorts occurrences chronologically", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));

    setEvents([
      createdDoc({
        _id: "later",
        title: "ب",
        startAt: new Date("2026-09-15T15:00:00Z"),
        endAt: null,
        recurrence: { type: "once" },
      }),
      createdDoc({
        _id: "earlier",
        title: "أ",
        startAt: new Date("2026-09-11T15:00:00Z"),
        endAt: null,
        recurrence: { type: "once" },
      }),
    ]);

    const res = await getScheduleForStudent(GID);

    expect(res.data.map((o) => o.title)).toEqual(["أ", "ب"]);
  });
});

describe("admin schedule CRUD authorization", () => {
  it("students cannot create schedule events", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await createScheduleEvent(VALID_INPUT);

    expect(res.success).toBe(false);
    expect(ScheduleEvent.create).not.toHaveBeenCalled();
  });

  it("admin can update and delete an event of any grade", async () => {
    ScheduleEvent.findById.mockReturnValue(chain({ gradeId: GID }));
    ScheduleEvent.findByIdAndUpdate.mockReturnValue(
      findByIdChain({ _id: EID, title: "معدل" })
    );
    ScheduleEvent.findByIdAndDelete.mockResolvedValue({ _id: EID });

    const upd = await updateScheduleEvent({
      eventId: EID,
      ...VALID_INPUT,
      title: "معدل",
    });
    expect(upd.success).toBe(true);

    const del = await deleteScheduleEvent(EID);
    expect(del.success).toBe(true);
  });

  it("staff listing requires staff on grade", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await listScheduleEventsForStaff(GID);

    expect(res.success).toBe(false);
  });
});

describe("schedule UI decoupled from lectures", () => {
  it("ScheduleSection has no LectureForm/lecture-action references", async () => {
    const fs = await import("node:fs");
    const section = fs.readFileSync(
      new URL("../../src/app/components/schedule/ScheduleSection.jsx", import.meta.url),
      "utf8"
    );
    expect(section).not.toContain("LectureForm");
    expect(section).not.toContain("getLecturesForStaff");
    expect(section).not.toContain("updateLecture");
    expect(section).toContain("createScheduleEvent");
  });

  it("student schedule view consumes ScheduleEvent occurrences", async () => {
    const fs = await import("node:fs");
    const detail = fs.readFileSync(
      new URL("../../src/app/components/userDashboard/GradeDetail.jsx", import.meta.url),
      "utf8"
    );
    expect(detail).toContain("getScheduleForStudent");
    expect(detail).not.toContain("getStudentSchedule");
  });

  it("timezone constant is centralized", async () => {
    const fs = await import("node:fs");
    const timeLib = fs.readFileSync(
      new URL("../../lib/schedule/time.js", import.meta.url),
      "utf8"
    );
    expect(timeLib).toContain('"Africa/Cairo"');
  });
});