import checkUser from "../../../../lib/checkUser";
import connectToDatabase from "../../../../lib/connectToDb";
import Essay from "../../../../models/Essay";
import GradeStaffAssignment from "../../../../models/GradeStaffAssignment";
import mongoose from "mongoose";
import { withCaller, withHttpTrace, withTracePhase } from "../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_get_essays", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_get_essays", async () => {
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

        const url = new URL(req.url);

        const page = parseInt(url.searchParams.get("page"), 10) || 1;
        const limit = parseInt(url.searchParams.get("limit"), 10) || 10;
        const adminId = url.searchParams.get("adminId");

        // Assistants are scoped to their staffed grades; admins see all.
        let allowedGradeIds = [];
        if (adminId && adminId !== "null" && user?.role === "assistant") {
          const assignments = await GradeStaffAssignment.find({
            assistantId: new mongoose.Types.ObjectId(adminId),
          }).select("gradeId");

          allowedGradeIds = assignments.map((m) => m.gradeId);
          if (allowedGradeIds.length === 0) {
            return new Response(
              JSON.stringify({
                success: true,
                data: [],
                pagination: {
                  currentPage: page,
                  totalPages: 0,
                  totalEssays: 0,
                  limit,
                },
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }

        const matchStage = { isCompleted: false };

        let pipeline = [
          { $match: matchStage },
          {
            $lookup: {
              from: "submissions",
              localField: "submissionId",
              foreignField: "_id",
              as: "submission",
            },
          },
          { $unwind: "$submission" },
        ];

        if (allowedGradeIds.length > 0) {
          pipeline.push({
            $match: {
              "submission.gradeId": { $in: allowedGradeIds },
            },
          });
        }

        pipeline.push(
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          // Bounded teacher-facing context (post-pagination): exam title and
          // grade name from the new domain — no Course/Lesson fields exist.
          {
            $lookup: {
              from: "exams",
              localField: "submission.exam",
              foreignField: "_id",
              as: "examInfo",
            },
          },
          {
            $lookup: {
              from: "grades",
              localField: "submission.gradeId",
              foreignField: "_id",
              as: "gradeInfo",
            },
          },
          {
            $addFields: {
              examTitle: { $arrayElemAt: ["$examInfo.title", 0] },
              gradeName: { $arrayElemAt: ["$gradeInfo.name", 0] },
            },
          },
          {
            $project: {
              essays: 1,
              createdAt: 1,
              submissionId: 1,
              examTitle: 1,
              gradeName: 1,
              "user.firstName": 1,
              "user.lastName": 1,
              "user.email": 1,
            },
          },
        );

        const totalEssays = await Essay.countDocuments(matchStage);
        const totalPages = Math.ceil(totalEssays / limit);

        const data = await Essay.aggregate(pipeline);

        return new Response(
          JSON.stringify({
            success: true,
            data,
            pagination: {
              currentPage: page,
              totalPages,
              totalEssays,
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
