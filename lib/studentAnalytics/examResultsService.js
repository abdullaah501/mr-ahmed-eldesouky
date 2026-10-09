import "server-only";

import Submission from "../../models/Submission";

export async function getStudentExamResults({ studentId, page = 1, limit = 10 }) {
  const totalResults = await Submission.countDocuments({ student: studentId });

  const totalPages = Math.ceil(totalResults / limit);

  const submissions = await Submission.find({ student: studentId })
    .select("score isCompleted createdAt exam")
    .populate({
      path: "exam",
      select: "title gradeId",
      populate: {
        path: "gradeId",
        select: "name -_id",
      },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();

  // Shape kept compatible with previous consumers: course/lesson titles
  // become exam title + grade name.
  const examsResults = submissions.map((s) => ({
    _id: s._id,
    examId: s.exam?._id || null,
    score: s.score,
    isCompleted: s.isCompleted,
    createdAt: s.createdAt,
    courseId: null,
    lessonId: null,
    examTitle: s.exam?.title || "",
    gradeName: s.exam?.gradeId?.name || "",
  }));

  return {
    data: examsResults,
    pagination: {
      currentPage: page,
      totalPages,
      totalResults,
      limit,
    },
  };
}

/** Read-only attendance summary for the guardian portal. */
export async function getStudentAttendanceSummary(studentId) {
  const AttendanceRecord = (await import("../../models/AttendanceRecord")).default;

  const records = await AttendanceRecord.find({
    "entries.studentId": studentId,
  })
    .sort({ date: -1 })
    .limit(100)
    .select("date entries gradeId")
    .populate({ path: "gradeId", select: "name -_id" })
    .lean();

  let total = 0;
  let attended = 0;
  const sessions = [];
  for (const r of records) {
    const mine = (r.entries || []).find(
      (e) => String(e.studentId) === String(studentId)
    );
    if (!mine) continue;
    total += 1;
    if (mine.status === "present" || mine.status === "late") attended += 1;
    sessions.push({
      date: r.date,
      gradeName: r.gradeId?.name || "",
      status: mine.status,
    });
  }

  return {
    percentage: total > 0 ? Math.round((attended / total) * 100) : null,
    total,
    attended,
    sessions,
  };
}
