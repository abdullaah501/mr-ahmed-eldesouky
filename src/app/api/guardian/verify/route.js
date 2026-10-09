import { NextResponse } from "next/server";
import connectToDatabase from "../../../../../lib/connectToDb";
import User from "../../../../../models/User";
import { checkRouteRateLimit } from "../../../../../lib/routeRateLimit";
import {
  hashGuardianToken,
  isValidGuardianTokenFormat,
} from "../../../../../lib/guardianToken";
import { getStudentExamResults, getStudentAttendanceSummary } from "../../../../../lib/studentAnalytics/examResultsService";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../../lib/trace/index.js";
import { logSecurityEvent } from "../../../../../lib/securityLogger";

const GENERIC_INVALID = {
  success: false,
  message: "Link is invalid or expired",
};

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 5;

export async function GET(req) {
  return withCaller("api_guardian_verify", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_guardian_verify", async () => {
        try {
          const limited = await checkRouteRateLimit(req, "guardianVerify");
          if (limited) {
            logSecurityEvent("RATE_LIMIT_HIT", { reason: "guardianVerify" });
            return NextResponse.json(
              { success: false, message: "Too many attempts. Please try again later" },
              {
                status: 429,
                headers: { "Cache-Control": "private, no-store" },
              }
            );
          }

          const url = new URL(req.url);
          const token = url.searchParams.get("token");
          const pageParam = parseInt(url.searchParams.get("page"), 10);
          const limitParam = parseInt(url.searchParams.get("limit"), 10);

          if (!token || !isValidGuardianTokenFormat(token)) {
            return NextResponse.json(
              { success: false, message: GENERIC_INVALID.message },
              { status: 404, headers: { "Cache-Control": "private, no-store" } }
            );
          }

          await connectToDatabase();

          const hash = hashGuardianToken(token);
          const student = await User.findOne({
            guardianTokenHash: hash,
            role: "student",
          })
            .select("firstName lastName grade image")
            .lean();

          if (!student) {
            return NextResponse.json(
              { success: false, message: GENERIC_INVALID.message },
              { status: 404, headers: { "Cache-Control": "private, no-store" } }
            );
          }

          const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
          const limit =
            Number.isFinite(limitParam) && limitParam > 0 && limitParam <= MAX_LIMIT
              ? limitParam
              : DEFAULT_LIMIT;

          const [{ data: examResults, pagination: examResultsPagination }, attendance] =
            await Promise.all([
              getStudentExamResults({ studentId: student._id, page, limit }),
              getStudentAttendanceSummary(student._id),
            ]);

          return NextResponse.json(
            {
              success: true,
              data: {
                student: {
                  firstName: student.firstName,
                  lastName: student.lastName,
                  grade: student.grade,
                  image: student.image || { url: "", cloudId: "" },
                },
                examResults,
                examResultsPagination,
                attendance,
              },
            },
            {
              status: 200,
              headers: { "Cache-Control": "private, no-store" },
            }
          );
        } catch (error) {
          console.error("Guardian verify error:", error);
          return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500, headers: { "Cache-Control": "private, no-store" } }
          );
        }
      })
    )
  );
}