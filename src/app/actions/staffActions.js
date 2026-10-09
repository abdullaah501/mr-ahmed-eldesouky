"use server";

import User from "../../../models/User";
import Grade from "../../../models/Grade";
import GradeStaffAssignment from "../../../models/GradeStaffAssignment";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import { getStaffedGradeIds } from "../../../lib/services/gradeAuth";
import { logSecurityEvent } from "../../../lib/securityLogger";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

async function requireAdmin() {
  const { success, user } = await checkUser();
  if (!success || !user || user.role !== "admin") return null;
  return user;
}

export async function addStaffMember({ assistantId, gradeId }) {
  return withCaller("action_add_staff", () =>
    withTracePhase("server_action", async () => {
      const admin = await requireAdmin();
      if (!admin) return { success: false, message: "Unauthorized" };
      if (!isValidId(assistantId) || !isValidId(gradeId)) {
        return { success: false, message: "Invalid IDs" };
      }

      await connectToDatabase();

      // Server-side target validation: any registered user except admins is
      // selectable. A student is promoted to assistant as part of the
      // existing assignment workflow (role bump + tokenVersion so their
      // next refresh picks up the new role).
      const user = await User.findOne({
        _id: assistantId,
        role: { $ne: "admin" },
      })
        .select("_id role")
        .lean();
      if (!user) {
        return { success: false, message: "User not found" };
      }

      if (user.role === "student") {
        await User.updateOne(
          { _id: assistantId },
          { $set: { role: "assistant" }, $inc: { tokenVersion: 1 } }
        );
        logSecurityEvent("ROLE_CHANGED", {
          userId: String(assistantId),
          from: "student",
          to: "assistant",
        });
      }

      const grade = await Grade.findById(gradeId).select("_id").lean();
      if (!grade) return { success: false, message: "Grade not found" };

      try {
        await GradeStaffAssignment.create({
          assistantId,
          gradeId,
          assignedBy: admin._id,
        });
      } catch (err) {
        if (err?.code === 11000) {
          return { success: false, message: "This assistant is already assigned to this grade" };
        }
        throw err;
      }

      return {
        success: true,
        message:
          user.role === "student"
            ? "User promoted to assistant and assigned to the grade"
            : "Assigned",
      };
    })
  );
}

export async function removeStaffMember(assignmentId) {
  return withCaller("action_remove_staff", () =>
    withTracePhase("server_action", async () => {
      const admin = await requireAdmin();
      if (!admin) return { success: false, message: "Unauthorized" };
      if (!isValidId(assignmentId)) {
        return { success: false, message: "Invalid ID" };
      }
      await connectToDatabase();

      const removed = await GradeStaffAssignment.findByIdAndDelete(assignmentId)
        .lean();
      if (!removed) return { success: true };

      // Lifecycle invariant: role = assistant requires at least one active
      // GradeStaffAssignment. Demote only when the LAST assignment is gone.
      const remaining = await GradeStaffAssignment.countDocuments({
        assistantId: removed.assistantId,
      });
      if (remaining === 0) {
        await User.updateOne(
          { _id: removed.assistantId },
          { $set: { role: "student" }, $inc: { tokenVersion: 1 } }
        );
        logSecurityEvent("ROLE_CHANGED", {
          userId: String(removed.assistantId),
          from: "assistant",
          to: "student",
        });
      }

      return { success: true };
    })
  );
}

export async function getStaffAssignments() {
  return withCaller("action_get_staff", () =>
    withTracePhase("server_action", async () => {
      const admin = await requireAdmin();
      if (!admin) return { success: false, message: "Unauthorized" };

      await connectToDatabase();

      const assignments = await GradeStaffAssignment.find({})
        .sort({ createdAt: -1 })
        .populate("assistantId", "firstName lastName email")
        .populate("gradeId", "name")
        .lean();

      return { success: true, data: JSON.parse(JSON.stringify(assignments)) };
    })
  );
}

/** Assistant self-view: grades they are staffed on. */
export async function getMyGradesForAssistant() {
  return withCaller("action_my_grades_assistant", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user || user.role !== "assistant") {
        return { success: false, message: "Unauthorized" };
      }
      await connectToDatabase();
      const ids = await getStaffedGradeIds(user._id);
      const Grade = (await import("../../../models/Grade")).default;
      const grades = ids.length
        ? await Grade.find({ _id: { $in: ids }, active: true })
            .select("_id name active")
            .lean()
        : [];
      return { success: true, data: grades.map((g) => ({ ...g, _id: String(g._id) })) };
    })
  );
}
