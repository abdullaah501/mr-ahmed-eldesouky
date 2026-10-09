"use server";

import mongoose from "mongoose";
import Lecture from "../../../models/Lecture";
import Grade from "../../../models/Grade";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import { validateRecordingInput } from "../../../lib/video/recording";
import {
  resolveGradeAccess,
  isStaff,
  getStaffedGradeIds,
} from "../../../lib/services/gradeAuth";
import { createNotificationsForGrade } from "../../../lib/services/notificationService";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

async function requireStaffOnGrade(user, gradeId) {
  if (user.role === "admin") return true;
  if (user.role === "assistant") return isStaff(user._id, gradeId);
  return false;
}

function normalizeScheduledFor(scheduledFor) {
  if (!scheduledFor) return null;
  const d = new Date(scheduledFor);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function createLecture({
  gradeId,
  title,
  description,
  recording,
  scheduledFor,
  files,
  publish,
}) {
  const { success, user } = await withCaller("action_create_lecture", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };
  if (typeof title !== "string" || title.trim().length < 2) {
    return { success: false, message: "Lecture title is required" };
  }

  await connectToDatabase();

  if (!(await requireStaffOnGrade(user, gradeId))) {
    return { success: false, message: "Not authorized for this grade" };
  }

  let normalizedRecording = null;
  if (recording?.provider) {
    const res = validateRecordingInput(recording);
    if (!res.ok) return { success: false, message: res.message };
    normalizedRecording = res.recording;
  }

  const sched = normalizeScheduledFor(scheduledFor);
  if (sched === undefined) {
    return { success: false, message: "Invalid schedule date" };
  }

  let status = "draft";
  if (publish) status = "published";
  else if (sched) status = "scheduled";

  const lecture = await Lecture.create({
    gradeId,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : "",
    recording: normalizedRecording,
    scheduledFor: sched,
    files: Array.isArray(files)
      ? files
          .filter((f) => f && isValidIdOrUrl(f))
          .slice(0, 20)
          .map((f) => ({ name: String(f.name || "").slice(0, 200), url: f.url, cloudId: f.cloudId }))
      : [],
    status,
    publishedAt: status === "published" ? new Date() : null,
    createdBy: user._id,
  });

  if (status === "published") {
    // Fan-out runs in the background — lecture creation must not block on it.
    void createNotificationsForGrade({
      gradeId,
      type: "new_lecture",
      title: "New lecture",
      body: lecture.title,
      link: `/userDashboard/grades/${gradeId}`,
    }).catch((error) => {
      console.error("new_lecture notification failed:", error);
    });
  }

  return { success: true, data: JSON.parse(JSON.stringify(lecture.toObject())) };
}

function isValidIdOrUrl(f) {
  return f && typeof f.url === "string" && f.url.length > 0 && f.url.length < 2000;
}

export async function updateLecture({
  lectureId,
  title,
  description,
  recording,
  scheduledFor,
  files,
}) {
  const { success, user } = await withCaller("action_update_lecture", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(lectureId)) return { success: false, message: "Invalid lectureId" };

  await connectToDatabase();

  const lecture = await Lecture.findById(lectureId).select("gradeId").lean();
  if (!lecture) return { success: false, message: "Lecture not found" };
  if (!(await requireStaffOnGrade(user, String(lecture.gradeId)))) {
    return { success: false, message: "Not authorized for this grade" };
  }

  const patch = {};
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length < 2) {
      return { success: false, message: "Lecture title is required" };
    }
    patch.title = title.trim();
  }
  if (description !== undefined) {
    patch.description = typeof description === "string" ? description.trim() : "";
  }
  if (recording !== undefined) {
    if (!recording?.provider) {
      patch.recording = null;
    } else {
      const res = validateRecordingInput(recording);
      if (!res.ok) return { success: false, message: res.message };
      patch.recording = res.recording;
    }
  }
  if (scheduledFor !== undefined) {
    const sched = normalizeScheduledFor(scheduledFor);
    if (sched === undefined) {
      return { success: false, message: "Invalid schedule date" };
    }
    patch.scheduledFor = sched;
  }
  if (files !== undefined) {
    patch.files = Array.isArray(files)
      ? files
          .filter((f) => f && isValidIdOrUrl(f))
          .slice(0, 20)
          .map((f) => ({ name: String(f.name || "").slice(0, 200), url: f.url, cloudId: f.cloudId }))
      : [];
  }

  // Keep status coherent: a draft with a schedule becomes scheduled.
  if (patch.scheduledFor !== undefined && lecture.status === "draft" && patch.scheduledFor) {
    patch.status = "scheduled";
  }

  const updated = await Lecture.findByIdAndUpdate(lectureId, patch, { new: true }).lean();
  return { success: true, data: JSON.parse(JSON.stringify(updated)) };
}

export async function setLectureStatus(lectureId, status) {
  const { success, user } = await withCaller("action_set_lecture_status", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(lectureId)) return { success: false, message: "Invalid lectureId" };

  await connectToDatabase();

  const lecture = await Lecture.findById(lectureId).select("gradeId status").lean();
  if (!lecture) return { success: false, message: "Lecture not found" };
  if (!(await requireStaffOnGrade(user, String(lecture.gradeId)))) {
    return { success: false, message: "Not authorized for this grade" };
  }

  const now = new Date();
  const patch =
    status === "published"
      ? {
          status: "published",
          publishedAt: lecture.publishedAt || now,
        }
      : status === "draft" || status === "scheduled"
        ? {
            status,
            ...(status === "draft" ? { publishedAt: null } : {}),
          }
        : null;
  if (!patch) return { success: false, message: "Invalid status" };

  const updated = await Lecture.findByIdAndUpdate(lectureId, patch, { new: true }).lean();

  if (status === "published" && lecture.status !== "published") {
    // Fan-out runs in the background — publish must not block on it.
    void createNotificationsForGrade({
      gradeId: String(lecture.gradeId),
      type: "new_lecture",
      title: "New lecture",
      body: updated.title,
      link: `/userDashboard/grades/${String(lecture.gradeId)}`,
    }).catch((error) => {
      console.error("new_lecture notification failed:", error);
    });
  }

  return { success: true, data: JSON.parse(JSON.stringify(updated)) };
}

export async function removeLecture(lectureId) {
  const { success, user } = await withCaller("action_remove_lecture", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(lectureId)) return { success: false, message: "Invalid lectureId" };

  await connectToDatabase();

  const lecture = await Lecture.findById(lectureId).select("gradeId files.thumbnail").lean();
  if (!lecture) return { success: false, message: "Lecture not found" };
  if (!(await requireStaffOnGrade(user, String(lecture.gradeId)))) {
    return { success: false, message: "Not authorized for this grade" };
  }

  const cloudIds = [];
  if (lecture.files?.length) {
    for (const f of lecture.files) {
      if (f.cloudId) cloudIds.push(f.cloudId);
    }
  }
  if (lecture.thumbnail?.cloudId) cloudIds.push(lecture.thumbnail.cloudId);

  await Lecture.findByIdAndDelete(lectureId);

  if (cloudIds.length > 0) {
    const { deleteMultipleFromStorage } = await import("../../../lib/deleteFromStorage");
    try {
      await deleteMultipleFromStorage(cloudIds);
    } catch (_) {}
  }

  return { success: true };
}

/** Admin/assistant listing — all statuses. */
export async function getLecturesForStaff(gradeId) {
  const { success, user } = await withCaller("action_get_lectures_staff", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };

  await connectToDatabase();

  if (!(await requireStaffOnGrade(user, gradeId))) {
    return { success: false, message: "Not authorized for this grade" };
  }

  const lectures = await Lecture.find({ gradeId })
    .sort({ scheduledFor: -1, createdAt: -1 })
    .populate("gradeId", "name")
    .lean();

  return { success: true, data: JSON.parse(JSON.stringify(lectures)) };
}

/** Student listing — published lectures of the student's own profile Grade. */
export async function getLecturesForStudent(gradeId) {
  const { success, user } = await withCaller("action_get_lectures_student", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };

  await connectToDatabase();

  const access = await resolveGradeAccess({
    userId: user._id,
    gradeId,
    userGradeId: user.gradeId,
  });
  if (!access.allowed) {
    return { success: false, message: "Unauthorized" };
  }

  const lectures = await Lecture.find({ gradeId, status: "published" })
    .sort({ scheduledFor: -1, createdAt: -1 })
    .select("-createdBy")
    .lean();

  return { success: true, data: JSON.parse(JSON.stringify(lectures)) };
}
