import checkUser from "../../../../lib/checkUser";
import connectToDatabase from '../../../../lib/connectToDb';
import Submission from "../../../../models/Submission";
import Exam from "../../../../models/Exam";
import User from "../../../../models/User";
import { getStaffedGradeIds } from "../../../../lib/services/gradeAuth";
import { withCaller, withHttpTrace, withTracePhase } from "../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_users_exams_results", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_users_exams_results", async () => {
        const { success, user } = await checkUser();

        if (!success || (user?.role !== "admin" && user?.role !== "assistant")) {
          return new Response(
            JSON.stringify({ success: false, message: "Unauthorized" }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await connectToDatabase();

        // Assistant grade authorization (server-side). `null` for admin = all grades.
        let staffedGradeIds = null;
        if (user.role === "assistant") {
          staffedGradeIds = await getStaffedGradeIds(user._id);
        }

        const url = new URL(req.url);

        // Query A — minimal exam filter options for the Exam select. Returns
        // only exams that have at least one submission and skips the paginated
        // results/count queries entirely.
        if (url.searchParams.get("options") === "1") {
          // Assistant: only exams in staffed grades; empty set when none.
          if (user.role === "assistant" && staffedGradeIds.length === 0) {
            return new Response(
              JSON.stringify({ success: true, filterOptions: { exams: [] } }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          const examIds = await Submission.distinct("exam");
          const examQuery =
            user.role === "assistant"
              ? { _id: { $in: examIds }, gradeId: { $in: staffedGradeIds } }
              : { _id: { $in: examIds } };
          const exams = await Exam.find(examQuery, "title gradeId").lean();
          return new Response(
            JSON.stringify({
              success: true,
              filterOptions: {
                exams: exams.map((e) => ({
                  examId: String(e._id),
                  title: e.title || "",
                  gradeId: e.gradeId ? String(e.gradeId) : null,
                })),
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Query B — paginated, server-filtered results. One Mongo `filter` is
        // shared by countDocuments + find so pagination matches the filtered set.
        const page = parseInt(url.searchParams.get("page"), 10) || 1;
        const limit = parseInt(url.searchParams.get("limit"), 10) || 10;
        const gradeId = url.searchParams.get("gradeId") || "";
        const examId = url.searchParams.get("examId") || "";
        const search = (url.searchParams.get("search") || "").trim().slice(0, 100);

        const emptyPage = () =>
          new Response(
            JSON.stringify({
              success: true,
              data: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalResults: 0,
                limit,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );

        // Assistant: results are constrained to staffed grades (server-side).
        if (user.role === "assistant" && staffedGradeIds.length === 0) {
          return emptyPage();
        }

        const filter = {};

        // Grade — requested grade must be authorized (assistant). The requested
        // grade narrows the authorized set and never replaces it.
        if (gradeId) {
          if (user.role === "assistant" && !staffedGradeIds.includes(gradeId)) {
            return emptyPage();
          }
          filter.gradeId = gradeId;
        } else if (user.role === "assistant") {
          filter.gradeId = { $in: staffedGradeIds };
        }

        // Exam — an assistant's requested exam must belong to a staffed grade.
        if (examId) {
          if (user.role === "assistant") {
            const examDoc = await Exam.findById(examId).select("gradeId").lean();
            if (!examDoc || !staffedGradeIds.includes(String(examDoc.gradeId))) {
              return emptyPage();
            }
          }
          filter.exam = examId;
        }

        if (search) {
          const matched = await User.find(
            {
              $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
              ],
            },
            "_id"
          ).lean();
          if (matched.length === 0) {
            return emptyPage();
          }
          filter.student = { $in: matched.map((u) => u._id) };
        }

        const [totalResults, examsResults] = await Promise.all([
          Submission.countDocuments(filter),
          Submission.find(filter)
            .select("score isCompleted createdAt student gradeId exam")
            .populate([
              {
                path: "gradeId",
                select: "name",
              },
              {
                path: "exam",
                select: "title",
              },
              {
                path: "student",
                select: "firstName lastName email",
              }
            ])
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean()
        ]);

        const totalPages = Math.ceil(totalResults / limit);

        return new Response(
          JSON.stringify({
            success: true,
            data: examsResults,
            pagination: {
              currentPage: page,
              totalPages,
              totalResults,
              limit,
            },
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
