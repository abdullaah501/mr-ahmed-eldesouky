import checkUser from "../../../../lib/checkUser";
import Submission from "../../../../models/Submission";
import connectToDatabase from "./../../../../lib/connectToDb";
import { withCaller, withHttpTrace, withTracePhase } from "../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_get_submission", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_get_submission", async () => {
        const { success, user } = await checkUser();

        if (!success || !user) {
          return new Response(
            JSON.stringify({ success: false, message: "Unauthorized" }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const url = new URL(req.url);

        const studentId = url.searchParams.get("studentId");
        const examId = url.searchParams.get("examId");

        // Ownership guard: students may only read their own submissions.
        if (user.role === "student" && String(studentId) !== String(user._id)) {
          return new Response(
            JSON.stringify({ success: false, message: "Forbidden" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await connectToDatabase();

        const submission = await Submission.findOne({
          student: studentId,
          exam: examId,
        })
          .select("score questionsAnswered createdAt updatedAt isCompleted")
          .sort({ createdAt: 1 })
          .exec();

        if (!submission) {
          return new Response(
            JSON.stringify({ success: false, message: "Submission not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: submission,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    )
  );
}
