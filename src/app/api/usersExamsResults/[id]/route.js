import connectToDatabase from "../../../../../lib/connectToDb";
import Exam from "../../../../../models/Exam";
import User from "../../../../../models/User";
import Submission from "../../../../../models/Submission";
import checkUser from "../../../../../lib/checkUser";
import {
  isStaff,
  getStudentIdsForGrade,
} from "../../../../../lib/services/gradeAuth";

import mongoose from "mongoose";
import { withCaller, withHttpTrace, withTracePhase } from "../../../../../lib/trace/index.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function GET(req, { params }) {
  return withCaller("api_users_exams_results_by_id", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_users_exams_results_by_id", async () => {
        const { success, user } = await checkUser();

        if (!success || (user?.role !== "admin" && user?.role !== "assistant")) {
          return json({ success: false, message: "Unauthorized" }, 401);
        }

        await connectToDatabase();

        const { id: examId } = await params;

        if (!examId) {
          return json({ success: false, message: "examId is required" }, 400);
        }

        if (!mongoose.isValidObjectId(examId)) {
          return json({ success: false, message: "Invalid examId" }, 400);
        }

        const examObjId = new mongoose.Types.ObjectId(examId);

        const exam = await Exam.findById(examObjId).select("gradeId").lean();
        if (!exam || !exam.gradeId) {
          return json({ success: false, message: "Exam not found" }, 404);
        }

        // Assistant boundary: must be staffed on the exam's grade.
        if (user.role === "assistant") {
          const staffed = await isStaff(user._id, String(exam.gradeId));
          if (!staffed) {
            return json({ success: false, message: "Not authorized for this grade" }, 403);
          }
        }

        // Roster = students whose profile gradeId is the exam's Grade.
        const studentIds = await getStudentIdsForGrade(String(exam.gradeId));
        const [students, submissions] = await Promise.all([
          studentIds.length
            ? User.find({ _id: { $in: studentIds } })
                .select("firstName lastName email")
                .lean()
            : [],
          Submission.find({ exam: examObjId })
            .populate({ path: "student", select: "firstName lastName email" })
            .select("student score createdAt")
            .lean(),
        ]);

        const submittedMap = new Map();
        for (const sub of submissions) {
          if (!sub.student) continue;
          submittedMap.set(sub.student._id.toString(), sub);
        }

        const studentsWhoSubmitted = [];
        const studentsNotSubmitted = [];
        const seen = new Set();

        for (const student of students) {
          const studentId = student._id.toString();
          if (seen.has(studentId)) continue;
          seen.add(studentId);
          const sub = submittedMap.get(studentId);
          if (sub) {
            studentsWhoSubmitted.push({
              student,
              submission: { score: sub.score, createdAt: sub.createdAt },
            });
          } else {
            studentsNotSubmitted.push({
              student,
              submission: null,
            });
          }
        }

        return json({
          success: true,
          examId,
          gradeId: String(exam.gradeId),
          stats: {
            total: studentsWhoSubmitted.length + studentsNotSubmitted.length,
            submitted: studentsWhoSubmitted.length,
            notSubmitted: studentsNotSubmitted.length,
          },
          studentsWhoSubmitted,
          studentsNotSubmitted,
        });
      })
    )
  );
}
