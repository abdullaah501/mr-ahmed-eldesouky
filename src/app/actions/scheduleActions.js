"use server";

import ScheduleEvent from "../../../models/ScheduleEvent";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import { resolveGradeAccess, isStaff } from "../../../lib/services/gradeAuth";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";
import {
  cairoToUTC,
  addCairoDays,
  getCairoParts,
} from "../../../lib/schedule/time";

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

function isValidDateKey(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isValidTimeKey(v) {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Admin manages all grades; assistants only their GradeStaffAssignments. */
async function requireStaffOnGrade(user, gradeId) {
  if (user.role === "admin") return true;
  if (user.role === "assistant") return isStaff(user._id, gradeId);
  return false;
}

function normalizeEventInput({
  title,
  date,
  startTime,
  endTime,
  mode,
  locationName,
  locationAddress,
  onlineUrl,
  weekly,
}) {
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 200) {
    return { error: "Event title is required (2-200 characters)" };
  }
  if (!isValidDateKey(date) || !isValidTimeKey(startTime)) {
    return { error: "Invalid start date/time" };
  }
  if (endTime !== undefined && endTime !== null && endTime !== "" && !isValidTimeKey(endTime)) {
    return { error: "Invalid end time" };
  }

  const startAt = cairoToUTC({ date, time: startTime });
  let endAt = null;
  if (endTime) {
    endAt = cairoToUTC({ date, time: endTime });
    if (endAt.getTime() <= startAt.getTime()) {
      return { error: "End time must be after start time" };
    }
  }

  if (mode !== "offline" && mode !== "online") {
    return { error: "Invalid event type" };
  }

  const event = {
    title: title.trim(),
    startAt,
    endAt,
    mode,
    location: { name: "", address: "" },
    onlineUrl: "",
    recurrence: { type: weekly ? "weekly" : "once" },
  };

  if (mode === "offline") {
    event.location.name =
      typeof locationName === "string" ? locationName.trim().slice(0, 200) : "";
    event.location.address =
      typeof locationAddress === "string" ? locationAddress.trim().slice(0, 300) : "";
  } else if (typeof onlineUrl === "string" && onlineUrl.trim() !== "") {
    try {
      const u = new URL(onlineUrl.trim());
      if (u.protocol !== "https:") {
        return { error: "Meeting link must use https" };
      }
      event.onlineUrl = u.toString().slice(0, 2000);
    } catch {
      return { error: "Invalid meeting link" };
    }
  }

  return { event };
}

export async function createScheduleEvent(input) {
  return withCaller("action_create_schedule_event", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
        return { success: false, message: "Unauthorized" };
      }
      const { gradeId } = input || {};
      if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };

      await connectToDatabase();

      if (!(await requireStaffOnGrade(user, gradeId))) {
        return { success: false, message: "Not authorized for this grade" };
      }

      const normalized = normalizeEventInput(input || {});
      if (normalized.error) {
        return { success: false, message: normalized.error };
      }

      // Creates ONLY a ScheduleEvent — no educational content, recordings,
      // or streams are ever created by this domain.
      const event = await ScheduleEvent.create({
        ...normalized.event,
        gradeId,
        createdBy: user._id,
      });

      return {
        success: true,
        data: JSON.parse(JSON.stringify(event.toObject())),
      };
    })
  );
}

export async function updateScheduleEvent({ eventId, ...input }) {
  return withCaller("action_update_schedule_event", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
        return { success: false, message: "Unauthorized" };
      }
      if (!isValidId(eventId)) return { success: false, message: "Invalid ID" };

      await connectToDatabase();

      const existing = await ScheduleEvent.findById(eventId)
        .select("gradeId")
        .lean();
      if (!existing) return { success: false, message: "Event not found" };

      if (!(await requireStaffOnGrade(user, String(existing.gradeId)))) {
        return { success: false, message: "Not authorized for this grade" };
      }

      const normalized = normalizeEventInput(input || {});
      if (normalized.error) {
        return { success: false, message: normalized.error };
      }

      // Editing a weekly event edits the recurrence rule itself.
      const updated = await ScheduleEvent.findByIdAndUpdate(
        eventId,
        {
          title: normalized.event.title,
          startAt: normalized.event.startAt,
          endAt: normalized.event.endAt,
          mode: normalized.event.mode,
          location: normalized.event.location,
          onlineUrl: normalized.event.onlineUrl,
          recurrence: normalized.event.recurrence,
        },
        { new: true }
      ).lean();

      return {
        success: true,
        data: JSON.parse(JSON.stringify(updated)),
      };
    })
  );
}

export async function deleteScheduleEvent(eventId) {
  return withCaller("action_delete_schedule_event", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
        return { success: false, message: "Unauthorized" };
      }
      if (!isValidId(eventId)) return { success: false, message: "Invalid ID" };

      await connectToDatabase();

      const existing = await ScheduleEvent.findById(eventId)
        .select("gradeId")
        .lean();
      if (!existing) return { success: false, message: "Event not found" };

      if (!(await requireStaffOnGrade(user, String(existing.gradeId)))) {
        return { success: false, message: "Not authorized for this grade" };
      }

      await ScheduleEvent.findByIdAndDelete(eventId);
      return { success: true };
    })
  );
}

/** Admin/assistant: the schedule RULES of one grade (not occurrences). */
export async function listScheduleEventsForStaff(gradeId) {
  return withCaller("action_list_schedule_events", () =>
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

      const events = await ScheduleEvent.find({ gradeId })
        .sort({ startAt: 1 })
        .lean();

      return { success: true, data: JSON.parse(JSON.stringify(events)) };
    })
  );
}

/**
 * Student schedule: upcoming/current occurrences of the student's own
 * profile Grade (server-side resolveGradeAccess — never client-supplied).
 *
 * Window: Cairo "now" → +8 calendar weeks (Cairo). A weekly event's
 * occurrences are computed here — one MongoDB document per rule, never per
 * occurrence. An occurrence stays visible while in progress: with endAt
 * while `endAt > now`, otherwise while `startAt >= now`.
 */
export async function getScheduleForStudent(gradeId) {
  return withCaller("action_student_schedule", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
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

      const now = new Date();
      const from = now;
      const to = addCairoDays(now, 56); // 8-week horizon in Cairo calendar days

      const events = await ScheduleEvent.find({ gradeId }).lean();
      const occurrences = [];

      for (const ev of events) {
        const duration = ev.endAt
          ? ev.endAt.getTime() - ev.startAt.getTime()
          : 0;
        const payload = {
          eventId: String(ev._id),
          title: ev.title,
          mode: ev.mode,
          location: ev.location || { name: "", address: "" },
          onlineUrl: ev.onlineUrl || "",
          recurrence: ev.recurrence?.type || "once",
        };

        if (ev.recurrence?.type === "weekly") {
          // Jump the rule's start close to the window in whole Cairo weeks.
          let occ = ev.startAt;
          if (occ.getTime() < from.getTime()) {
            const p1 = getCairoParts(ev.startAt);
            const p2 = getCairoParts(from);
            const dayDiff = Math.floor(
              (Date.UTC(p2.year, p2.month - 1, p2.day) -
                Date.UTC(p1.year, p1.month - 1, p1.day)) /
                86400000
            );
            occ = addCairoDays(ev.startAt, Math.max(0, Math.floor(dayDiff / 7)) * 7);
          }

          let guard = 0;
          while (occ.getTime() <= to.getTime() && guard < 12) {
            const occEnd = duration
              ? new Date(occ.getTime() + duration)
              : null;
            const visible = occEnd
              ? occEnd.getTime() > now.getTime()
              : occ.getTime() >= now.getTime();
            if (visible) {
              occurrences.push({ ...payload, startAt: occ, endAt: occEnd });
            }
            occ = addCairoDays(occ, 7);
            guard++;
          }
        } else {
          const visible = ev.endAt
            ? ev.endAt.getTime() > now.getTime()
            : ev.startAt.getTime() >= now.getTime();
          if (visible && ev.startAt.getTime() <= to.getTime()) {
            occurrences.push({
              ...payload,
              startAt: ev.startAt,
              endAt: ev.endAt,
            });
          }
        }
      }

      occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

      return {
        success: true,
        data: JSON.parse(
          JSON.stringify(
            occurrences.map((o) => ({
              ...o,
              startAt: o.startAt.toISOString(),
              endAt: o.endAt ? o.endAt.toISOString() : null,
            }))
          )
        ),
      };
    })
  );
}
