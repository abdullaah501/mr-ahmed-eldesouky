import mongoose from "mongoose";
import { NextResponse } from "next/server";
import checkUser from "../../../../../lib/checkUser";
import connectToDatabase from "../../../../../lib/connectToDb";
import Submission from "../../../../../models/Submission";
import Grade from "../../../../../models/Grade";
import AttendanceRecord from "../../../../../models/AttendanceRecord";
import { getUserGradeIds } from "../../../../../lib/services/gradeAuth";

export async function GET(req) {
  try {
    const { success, user } = await checkUser();

    if (!success || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const userId = user._id;

    // 1. The student's own profile Grade (active only).
    const gradeIds = await getUserGradeIds(userId, user.gradeId);
    const gradeDocs = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } })
          .select("_id name")
          .lean()
      : [];

    const grades = gradeDocs.map((g) => ({
      gradeId: g._id,
      gradeName: g.name,
      enrolledAt: null,
    }));

    // 2. Grade summary (completed exam submissions)
    const submissions = await Submission.find({ student: userId, isCompleted: true })
      .select("score createdAt")
      .lean();

    let totalExamsTaken = submissions.length;
    let totalCorrect = 0;
    let totalWrong = 0;
    submissions.forEach((sub) => {
      totalCorrect += sub.score?.correct || 0;
      totalWrong += sub.score?.wrong || 0;
    });
    const totalQuestions = totalCorrect + totalWrong;
    const averageScore =
      totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const gradeSummary = {
      totalExamsTaken,
      averageScore,
      totalCorrect,
      totalWrong,
    };

    // 3. Attendance summary across granted grades
    const records = await AttendanceRecord.find({
      "entries.studentId": userId,
    })
      .sort({ date: -1 })
      .limit(100)
      .select("date entries")
      .lean();

    let attendedCount = 0;
    let attendanceTotal = 0;
    for (const r of records) {
      const mine = (r.entries || []).find(
        (e) => String(e.studentId) === String(userId)
      );
      if (!mine) continue;
      attendanceTotal += 1;
      if (mine.status === "present" || mine.status === "late") attendedCount += 1;
    }

    const attendance = {
      percentage:
        attendanceTotal > 0
          ? Math.round((attendedCount / attendanceTotal) * 100)
          : null,
      total: attendanceTotal,
      attended: attendedCount,
    };

    return NextResponse.json({
      success: true,
      data: {
        grades,
        gradeSummary,
        attendance,
      },
    });
  } catch (error) {
    console.error("Error in student analytics API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
