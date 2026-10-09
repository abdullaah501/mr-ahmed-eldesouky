"use server";

import mongoose from "mongoose";
import AttendanceRecord from "../../../models/AttendanceRecord";
import User from "../../../models/User";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import {
  isStaff,
  getUserGradeIds,
  getStudentIdsForGrade,
} from "../../../lib/services/gradeAuth";
import { createNotification } from "../../../lib/services/notificationService";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

const STATUSES = ["present", "absent", "late"];

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

function utcMidnight(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

async function requireStaffOnGrade(user, gradeId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "assistant") return isStaff(user._id, gradeId);
  return false;
}

async function getRoster(gradeId) {
  // Roster = students whose profile gradeId is this Grade (server-resolved).
  const ids = await getStudentIdsForGrade(gradeId);
  if (ids.length === 0) return [];
  const students = await User.find({ _id: { $in: ids }, role: "student" })
    .select("firstName lastName")
    .lean();
  return students.map((s) => ({
    studentId: String(s._id),
    name: `${s.firstName} ${s.lastName || ""}`.trim(),
  }));
}

export async function getAttendanceSession(gradeId, dateStr) {
  return withCaller("action_attendance_session", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
        return { success: false, message: "Unauthorized" };
      }
      if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };
      const date = utcMidnight(dateStr);
      if (!date) return { success: false, message: "Invalid date" };

      await connectToDatabase();
      if (!(await requireStaffOnGrade(user, gradeId))) {
        return { success: false, message: "Not authorized for this grade" };
      }

      const roster = await getRoster(gradeId);

      // Match any session of this grade on this UTC day (with or without lecture).
      const nextDay = new Date(date.getTime() + 86400000);
      const record = await AttendanceRecord.findOne({
        gradeId,
        date: { $gte: date, $lt: nextDay },
      }).lean();

      const existing = {};
      if (record) {
        for (const e of record.entries || []) {
          existing[String(e.studentId)] = e.status;
        }
      }

      return {
        success: true,
        data: {
          roster,
          recordId: record ? String(record._id) : null,
          lectureId: record?.lectureId ? String(record.lectureId) : null,
          statuses: existing,
        },
      };
    })
  );
}

export async function saveAttendanceSession({
  gradeId,
  lectureId,
  date,
  entries,
}) {
  return withCaller("action_save_attendance", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
        return { success: false, message: "Unauthorized" };
      }
      if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };
      if (lectureId != null && !isValidId(lectureId)) {
        return { success: false, message: "Invalid lectureId" };
      }
      const day = utcMidnight(date);
      if (!day) return { success: false, message: "Invalid date" };
      if (!Array.isArray(entries) || entries.length === 0) {
        return { success: false, message: "No attendance entries provided" };
      }
      const cleanEntries = [];
      const seen = new Set();
      for (const e of entries) {
        if (!e || !isValidId(e.studentId)) continue;
        if (!STATUSES.includes(e.status)) continue;
        if (seen.has(e.studentId)) continue;
        seen.add(e.studentId);
        cleanEntries.push({ studentId: e.studentId, status: e.status });
      }
      if (cleanEntries.length === 0) {
        return { success: false, message: "Invalid entries" };
      }

      await connectToDatabase();
      if (!(await requireStaffOnGrade(user, gradeId))) {
        return { success: false, message: "Not authorized for this grade" };
      }

      const filter = {
        gradeId,
        date: day,
        lectureId: lectureId ? new mongoose.Types.ObjectId(lectureId) : null,
      };
      const record = await AttendanceRecord.findOneAndUpdate(
        filter,
        {
          $set: {
            takenBy: user._id,
            entries: cleanEntries.map((e) => ({
              studentId: new mongoose.Types.ObjectId(e.studentId),
              status: e.status,
            })),
          },
          $setOnInsert: filter,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();

      // Notify flagged students (absent/late) once per save — grade-specific link.
      try {
        for (const e of cleanEntries) {
          if (e.status === "present") continue;
          await createNotification({
            userId: e.studentId,
            type: "attendance",
            title: "Attendance update",
            body:
              e.status === "absent"
                ? "You were marked absent for the last session"
                : "You were marked late for the last session",
            link: `/userDashboard/grades/${gradeId}`,
          });
        }
      } catch (_) {}

      return {
        success: true,
        data: { recordId: String(record._id) },
      };
    })
  );
}

/** Student self-view: own attendance for their profile Grade + percentage. */
export async function getMyAttendance() {
  return withCaller("action_my_attendance", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user) {
        return { success: false, message: "Unauthorized" };
      }

      await connectToDatabase();

      const gradeIds = await getUserGradeIds(user._id, user.gradeId);
      if (gradeIds.length === 0) {
        return { success: true, data: { sessions: [], percentage: null } };
      }

      const records = await AttendanceRecord.find({
        gradeId: { $in: gradeIds },
      })
        .sort({ date: -1 })
        .limit(200)
        .populate("gradeId", "name")
        .lean();

      let total = 0;
      let attended = 0;
      const sessions = [];
      for (const r of records) {
        const mine = (r.entries || []).find(
          (e) => String(e.studentId) === String(user._id)
        );
        if (!mine) continue;
        total += 1;
        if (mine.status === "present" || mine.status === "late") attended += 1;
        sessions.push({
          id: String(r._id),
          gradeId: String(r.gradeId?._id || r.gradeId),
          gradeName: r.gradeId?.name || "",
          date: r.date,
          status: mine.status,
          lectureId: r.lectureId ? String(r.lectureId) : null,
        });
      }

      return {
        success: true,
        data: {
          sessions: JSON.parse(JSON.stringify(sessions)),
          percentage:
            total > 0 ? Math.round((attended / total) * 100) : null,
        },
      };
    })
  );
}

/** Staff listing of past sessions for one grade. */
export async function getAttendanceSessionsForStaff(gradeId, { limit = 50 } = {}) {
  return withCaller("action_attendance_sessions_staff", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
        return { success: false, message: "Unauthorized" };
      }
      if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };

      await connectToDatabase();
      if (!(await requireStaffOnGrade(user, gradeId))) {
        return { success: false, message: "Not authorized for this grade" };
      }

      const records = await AttendanceRecord.find({ gradeId })
        .sort({ date: -1 })
        .limit(Math.min(limit, 100))
        .select("_id date lectureId entries takenBy createdAt")
        .populate("takenBy", "firstName lastName")
        .lean();

      const data = records.map((r) => {
        const counts = { present: 0, absent: 0, late: 0 };
        for (const e of r.entries || []) counts[e.status] += 1;
        return {
          id: String(r._id),
          date: r.date,
          lectureId: r.lectureId ? String(r.lectureId) : null,
          counts,
          total: (r.entries || []).length,
          takenBy: r.takenBy
            ? `${r.takenBy.firstName} ${r.takenBy.lastName || ""}`.trim()
            : "",
        };
      });

      return { success: true, data: JSON.parse(JSON.stringify(data)) };
    })
  );
}
