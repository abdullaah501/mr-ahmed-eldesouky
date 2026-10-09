import { NextResponse } from "next/server";
import connectToDatabase from "../../../../../lib/connectToDb";
import User from "../../../../../models/User";
import Submission from "../../../../../models/Submission";
import Exam from "../../../../../models/Exam";
import { checkRouteRateLimit } from "../../../../../lib/routeRateLimit";
import {
  hashGuardianToken,
  isValidGuardianTokenFormat,
} from "../../../../../lib/guardianToken";
import { hydrateExams } from "../../../../../lib/questions/QuestionHydrator";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../../lib/trace/index.js";
import { logSecurityEvent } from "../../../../../lib/securityLogger";

const NO_STORE = { "Cache-Control": "private, no-store" };
const GENERIC_INVALID = "Link is invalid or expired";
const ATTEMPT_NOT_FOUND = "Attempt not found";
const EXAM_ID_REGEX = /^[a-f0-9]{24}$/i;

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(req) {
  return withCaller("api_guardian_attempt", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_guardian_attempt", async () => {
        try {
          const limited = await checkRouteRateLimit(req, "guardianAttempt");
          if (limited) {
            logSecurityEvent("RATE_LIMIT_HIT", { reason: "guardianAttempt" });
            return json(
              {
                success: false,
                message: "Too many attempts. Please try again later",
              },
              429
            );
          }

          const token = req.headers.get("x-guardian-token");
          if (!isValidGuardianTokenFormat(token)) {
            return json({ success: false, message: GENERIC_INVALID }, 404);
          }

          await connectToDatabase();

          const hash = hashGuardianToken(token);
          const student = await User.findOne({
            guardianTokenHash: hash,
            role: "student",
          })
            .select("_id")
            .lean();

          if (!student) {
            return json({ success: false, message: GENERIC_INVALID }, 404);
          }

          const url = new URL(req.url);
          const examId = url.searchParams.get("examId") || "";
          if (!EXAM_ID_REGEX.test(examId)) {
            return json({ success: false, message: ATTEMPT_NOT_FOUND }, 404);
          }

          const submission = await Submission.findOne({
            student: student._id,
            exam: examId,
          })
            .select("score questionsAnswered isCompleted createdAt updatedAt")
            .lean();

          if (!submission) {
            return json({ success: false, message: ATTEMPT_NOT_FOUND }, 404);
          }

          const examDoc = await Exam.findById(examId).lean();

          let exam = null;
          if (examDoc) {
            const hydrated = await hydrateExams([examDoc]);
            exam = {
              _id: examDoc._id,
              questions: hydrated[0].questions,
            };
          }

          return json({ success: true, data: { submission, exam } });
        } catch (error) {
          console.error("Guardian attempt error:", error);
          return json(
            { success: false, message: "Internal server error" },
            500
          );
        }
      })
    )
  );
}
