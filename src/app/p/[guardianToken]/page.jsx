import {
  isValidGuardianTokenFormat,
  hashGuardianToken,
} from "../../../../lib/guardianToken";
import connectToDatabase from "../../../../lib/connectToDb";
import User from "../../../../models/User";
import { getStudentExamResults, getStudentAttendanceSummary } from "../../../../lib/studentAnalytics/examResultsService";
import { withCaller, withTracePhase } from "../../../../lib/trace/index.js";
import ParentDashboard from "@/app/components/guardian/ParentDashboard";
import ParentInvalidState from "@/app/components/guardian/ParentInvalidState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "متابعة ولي الأمر | أ. أحمد الدسوقي",
    robots: { index: false, follow: false },
  };
}

export default async function GuardianPage({ params }) {
  return withCaller("guardian_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { guardianToken } = await params;

      if (!isValidGuardianTokenFormat(guardianToken)) {
        return <ParentInvalidState />;
      }

      await connectToDatabase();

      const hash = hashGuardianToken(guardianToken);
      const student = await User.findOne({
        guardianTokenHash: hash,
        role: "student",
      })
        .select("firstName lastName grade image")
        .lean();

      if (!student) {
        return <ParentInvalidState />;
      }

      const [{ data: examResults, pagination: examResultsPagination }, attendance] =
        await Promise.all([
          getStudentExamResults({ studentId: student._id, page: 1, limit: 5 }),
          getStudentAttendanceSummary(student._id),
        ]);

      const payload = JSON.parse(
        JSON.stringify({
          student: {
            firstName: student.firstName,
            lastName: student.lastName,
            grade: student.grade,
            image: student.image || { url: "", cloudId: "" },
          },
          examResults,
          examResultsPagination,
          attendance,
        })
      );

      return (
        <ParentDashboard
          student={payload.student}
          examResults={payload.examResults}
          examResultsPagination={payload.examResultsPagination}
          attendance={payload.attendance}
          guardianToken={guardianToken}
        />
      );
    })
  );
}