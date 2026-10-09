"use server";

import { withCaller, withTracePhase } from "../../../lib/trace/index.js";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import Grade from "../../../models/Grade";
import Lecture from "../../../models/Lecture";
import Exam from "../../../models/Exam";
import AttendanceRecord from "../../../models/AttendanceRecord";
import GradeStaffAssignment from "../../../models/GradeStaffAssignment";

async function requireAdmin() {
  const { success, user } = await checkUser();
  if (!success || !user || user.role !== "admin") return null;
  return user;
}

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

export async function createGrade({ name }) {
  return withCaller("action_create_grade", () =>
    withTracePhase("server_action", async () => {
      const admin = await requireAdmin();
      if (!admin) return { success: false, message: "Unauthorized" };

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100
      ) {
        return { success: false, message: "Grade name is required (2-100 characters)" };
      }

      await connectToDatabase();
      try {
        const grade = await Grade.create({ name: name.trim(), active: true });
        return { success: true, data: grade.toObject() };
      } catch (err) {
        if (err?.code === 11000) {
          return { success: false, message: "A grade with this name already exists" };
        }
        throw err;
      }
    })
  );
}

export async function updateGrade({ gradeId, name, active }) {
  return withCaller("action_update_grade", () =>
    withTracePhase("server_action", async () => {
      const admin = await requireAdmin();
      if (!admin) return { success: false, message: "Unauthorized" };
      if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };

      // Grade.name is the canonical bridge to Question.grade metadata —
      // renaming is intentionally disabled. Admins may create and
      // activate/deactivate grades.
      if (name !== undefined) {
        return { success: false, message: "Renaming a grade is disabled" };
      }

      const patch = {};
      if (active !== undefined) {
        patch.active = Boolean(active);
      }
      if (Object.keys(patch).length === 0) {
        return { success: false, message: "Nothing to update" };
      }

      await connectToDatabase();
      const grade = await Grade.findByIdAndUpdate(gradeId, patch, { new: true }).lean();
      if (!grade) return { success: false, message: "Grade not found" };
      return { success: true, data: grade };
    })
  );
}

export async function removeGrade(gradeId) {
  return withCaller("action_remove_grade", () =>
    withTracePhase("server_action", async () => {
      const admin = await requireAdmin();
      if (!admin) return { success: false, message: "Unauthorized" };
      if (!isValidId(gradeId)) return { success: false, message: "Invalid gradeId" };

      await connectToDatabase();

      const [lectures, exams, attendance, staff] = await Promise.all([
        Lecture.countDocuments({ gradeId }),
        Exam.countDocuments({ gradeId }),
        AttendanceRecord.countDocuments({ gradeId }),
        GradeStaffAssignment.countDocuments({ gradeId }),
      ]);

      const refs = lectures + exams + attendance + staff;
      if (refs > 0) {
        return {
          success: false,
          message: `Cannot delete this grade because ${refs} item(s) are linked to it. Deactivate it instead.`,
        };
      }

      const res = await Grade.findByIdAndDelete(gradeId).lean();
      if (!res) return { success: false, message: "Grade not found" };
      return { success: true };
    })
  );
}
