import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../models/Notification", () => ({
  default: {
    aggregate: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../lib/checkUser", () => ({
  default: vi.fn(),
}));

vi.mock("../../lib/connectToDb", () => ({
  default: vi.fn(async () => ({})),
}));

vi.mock("../../lib/validateOrigin", () => ({
  validateOrigin: vi.fn(() => null),
}));

vi.mock("../../lib/routeRateLimit", () => ({
  checkRouteRateLimit: vi.fn(async () => false),
}));

import Notification from "../../models/Notification";
import checkUser from "../../lib/checkUser";
import {
  listNotificationsForAdmin,
  updateNotificationsForAdmin,
  deleteNotificationsForAdmin,
  getNotificationTtlDays,
} from "../../lib/services/notificationService";
import { GET as adminListGET } from "../../src/app/api/notifications/admin/route";
import { PATCH as adminPatch, DELETE as adminDelete } from "../../src/app/api/notifications/admin/[id]/route";

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const STUDENT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "student" };
const KEY = "cccccccccccccccccccccccc";
const ROW = {
  _id: KEY,
  groupId: "group-1",
  type: "announcement",
  title: "عنوان",
  body: "نص",
  link: "/userDashboard",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  recipients: 3,
};

const reqFor = (url, body) => ({
  url,
  json: body ? async () => body : undefined,
  headers: { get: () => null },
});

beforeEach(() => {
  vi.clearAllMocks();
  Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });
  Notification.deleteMany.mockResolvedValue({ deletedCount: 3 });
});

describe("listNotificationsForAdmin", () => {
  it("collapses fan-out documents into logical rows with expiry from TTL", async () => {
    Notification.aggregate
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await listNotificationsForAdmin({ page: 1, limit: 20 });

    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    const item = res.items[0];
    expect(item.key).toBe(KEY);
    expect(item.grouped).toBe(true);
    expect(item.recipients).toBe(3);
    const expectedExpiry =
      ROW.createdAt.getTime() + getNotificationTtlDays() * 86400000;
    expect(new Date(item.expiresAt).getTime()).toBe(expectedExpiry);
  });

  it("treats legacy ungrouped documents as single rows", async () => {
    Notification.aggregate
      .mockResolvedValueOnce([{ ...ROW, groupId: null }])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await listNotificationsForAdmin({ page: 1, limit: 20 });

    expect(res.items[0].grouped).toBe(false);
  });
});

describe("admin notification mutations", () => {
  it("updates every fan-out document of a grouped notification", async () => {
    const res = await updateNotificationsForAdmin("group-1", true, {
      title: "جديد",
    });
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { groupId: "group-1" },
      { $set: { title: "جديد" } }
    );
    expect(res.modified).toBe(3);
  });

  it("updates a legacy single document by its own _id", async () => {
    await updateNotificationsForAdmin(KEY, false, { title: "جديد" });
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { _id: KEY },
      { $set: { title: "جديد" } }
    );
  });

  it("never edits ownership/system fields", async () => {
    await updateNotificationsForAdmin("group-1", true, {
      title: "جديد",
      userId: STUDENT._id,
      type: "exam_result",
      createdAt: new Date(),
    });
    const [, setArg] = Notification.updateMany.mock.calls[0];
    expect(setArg.$set).toEqual({ title: "جديد" });
  });

  it("deletes grouped and legacy rows through the right filter", async () => {
    await deleteNotificationsForAdmin("group-1", true);
    expect(Notification.deleteMany).toHaveBeenCalledWith({ groupId: "group-1" });

    await deleteNotificationsForAdmin(KEY, false);
    expect(Notification.deleteMany).toHaveBeenCalledWith({ _id: KEY });
  });
});

describe("admin notification API authorization", () => {
  it("rejects a student listing notifications", async () => {
    checkUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await adminListGET(
      reqFor("http://localhost:3000/api/notifications/admin")
    );

    expect(res.status).toBe(403);
  });

  it("rejects a student editing a notification (forged PATCH)", async () => {
    checkUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await adminPatch(
      reqFor(
        `http://localhost:3000/api/notifications/admin/${KEY}?grouped=1`,
        { title: "اختراق" }
      ),
      { params: Promise.resolve({ id: KEY }) }
    );

    expect(res.status).toBe(403);
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a student deleting a notification", async () => {
    checkUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await adminDelete(
      reqFor(`http://localhost:3000/api/notifications/admin/${KEY}?grouped=1`),
      { params: Promise.resolve({ id: KEY }) }
    );

    expect(res.status).toBe(403);
    expect(Notification.deleteMany).not.toHaveBeenCalled();
  });

  it("allows an admin to list, edit and delete", async () => {
    checkUser.mockResolvedValue({ success: true, user: ADMIN });
    Notification.aggregate
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{ total: 1 }]);

    const listRes = await adminListGET(
      reqFor("http://localhost:3000/api/notifications/admin")
    );
    expect(listRes.status).toBe(200);

    const patchRes = await adminPatch(
      reqFor(
        `http://localhost:3000/api/notifications/admin/${KEY}?grouped=1`,
        { title: "معدل", link: "/userDashboard", body: "" }
      ),
      { params: Promise.resolve({ id: KEY }) }
    );
    expect(patchRes.status).toBe(200);
    expect(Notification.updateMany).toHaveBeenCalled();

    const deleteRes = await adminDelete(
      reqFor(`http://localhost:3000/api/notifications/admin/${KEY}?grouped=1`),
      { params: Promise.resolve({ id: KEY }) }
    );
    expect(deleteRes.status).toBe(200);
    expect(Notification.deleteMany).toHaveBeenCalled();
  });
});
