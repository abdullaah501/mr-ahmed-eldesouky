import checkUser from "../../../../lib/checkUser";
import connectToDatabase from '../../../../lib/connectToDb';
import { getStudentExamResults } from "../../../../lib/studentAnalytics/examResultsService";
import { withCaller, withHttpTrace, withTracePhase } from "../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_exams_results", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_exams_results", async () => {
        const { success, user, newAccessToken } = await checkUser();

        if (!success || user?.role !== "admin") {
          return new Response(
            JSON.stringify({ success: false, message: "Unauthorized" }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await connectToDatabase();

        const url = new URL(req.url);

        const page = parseInt(url.searchParams.get("page"), 10) || 1;
        const limit = parseInt(url.searchParams.get("limit"), 10) || 10;
        const studentId = url.searchParams.get("studentId");

        const { data: examsResults, pagination } = await getStudentExamResults({
          studentId,
          page,
          limit,
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: examsResults,
            pagination,
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
