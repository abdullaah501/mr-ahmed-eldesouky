import { NextResponse } from "next/server";
import checkUser from "../../../../lib/checkUser";
import connectToDatabase from "../../../../lib/connectToDb";
import User from "../../../../models/User";
import Grade from "../../../../models/Grade";

export async function GET(req) {
  try {
    const { success, user } = await checkUser();
    if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const student = await User.findById(id)
      .select("firstName lastName grade gradeId phone guardianPhone email createdAt image")
      .lean();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Presentation-only compatibility shape: the student's own profile Grade.
    // Authorization itself always uses the authenticated user's gradeId.
    let grantedGrades = [];
    if (student.gradeId) {
      const grade = await Grade.findById(String(student.gradeId))
        .select("_id name active")
        .lean();
      if (grade && grade.active) {
        grantedGrades = [
          {
            _id: grade._id,
            name: grade.name,
            expiresAt: null,
            status: "active",
          },
        ];
      }
    }

    return NextResponse.json({
      success: true,
      student,
      grades: grantedGrades,
      tabsData: [
        { id: 1, title: "Granted Grades", count: grantedGrades.length },
      ],
    });
  } catch (error) {
    console.error("Error in getUserAnalytics:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
