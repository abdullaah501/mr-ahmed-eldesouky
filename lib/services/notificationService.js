import "server-only";
import mongoose from "mongoose";
import Notification from "../../models/Notification";
import { getStudentIdsForGrade } from "./gradeAuth";

/**
 * Fan-out-on-write notification domain.
 * One Notification document per recipient — SSE filters by userId directly,
 * read-state is a simple readAt field, and old docs expire via TTL.
 */

export async function createNotification({
  userId,
  type,
  title,
  body = "",
  link = "",
}) {
  return Notification.create({
    userId,
    type,
    title,
    body,
    link,
    groupId: new mongoose.Types.ObjectId().toString(),
  });
}

/** Resolve the students of a grade (profile gradeId) and insert one doc per student. */
export async function createNotificationsForGrade({
  gradeId,
  type,
  title,
  body = "",
  link = "",
}) {
  const studentIds = await getStudentIdsForGrade(gradeId);
  if (studentIds.length === 0) {
    return { inserted: 0 };
  }

  // One logical grade-wide send → one groupId shared by all its documents.
  const groupId = new mongoose.Types.ObjectId().toString();
  await Notification.insertMany(
    studentIds.map((userId) => ({ userId, type, title, body, link, groupId }))
  );
  return { inserted: studentIds.length };
}

/**
 * Admin management: list persisted notifications as logical notifications
 * (fan-out documents collapse into one row via groupId). TTL still governs
 * existence — only records that have not expired appear here.
 */
export async function listNotificationsForAdmin({ page = 1, limit = 20 } = {}) {
  const ttlDays = getNotificationTtlDays();
  const [agg, countAgg] = await Promise.all([
    Notification.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$groupId", { $toString: "$_id" }] },
          type: { $first: "$type" },
          title: { $first: "$title" },
          body: { $first: "$body" },
          link: { $first: "$link" },
          createdAt: { $max: "$createdAt" },
          recipients: { $sum: 1 },
          groupId: { $first: "$groupId" },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]),
    Notification.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$groupId", { $toString: "$_id" }] },
        },
      },
      { $count: "total" },
    ]),
  ]);

  const total = countAgg[0]?.total || 0;
  const items = agg.map((row) => ({
    key: row._id,
    // Docs created before groupId existed have groupId null and are managed
    // as single documents by their own _id.
    grouped: row.groupId != null,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.createdAt,
    recipients: row.recipients,
    expiresAt: new Date(
      new Date(row.createdAt).getTime() + ttlDays * 86400000
    ),
  }));
  return { items, total, page, limit };
}

const ADMIN_EDITABLE_FIELDS = ["title", "body", "link"];

/**
 * Admin edit of a logical notification's content. Never touches userId,
 * type, createdAt or the underlying Lecture/Exam — only notification docs.
 */
export async function updateNotificationsForAdmin(key, grouped, patch) {
  const set = {};
  for (const field of ADMIN_EDITABLE_FIELDS) {
    if (patch[field] !== undefined) set[field] = patch[field];
  }
  if (Object.keys(set).length === 0) return { modified: 0 };
  const filter = grouped ? { groupId: key } : { _id: key };
  const res = await Notification.updateMany(filter, { $set: set });
  return { modified: res.modifiedCount || 0 };
}

/** Admin delete of a logical notification (all its fan-out documents). */
export async function deleteNotificationsForAdmin(key, grouped) {
  const filter = grouped ? { groupId: key } : { _id: key };
  const res = await Notification.deleteMany(filter);
  return { deleted: res.deletedCount || 0 };
}

export async function listNotifications(userId, { limit = 20, page = 1 } = {}) {
  const filter = { userId };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return { items, total, unread, page };
}

export async function markNotificationsRead(userId, ids = null) {
  const filter = { userId, readAt: null };
  if (Array.isArray(ids) && ids.length > 0) {
    filter._id = { $in: ids };
  }
  const res = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return { modified: res.modifiedCount || 0 };
}

export function getNotificationTtlDays() {
  const raw = parseInt(process.env.NOTIFICATION_TTL_DAYS, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}
