import { NextResponse } from "next/server";
import checkUser from "../../../../../lib/checkUser";
import connectToDatabase from "../../../../../lib/connectToDb";
import User from "../../../../../models/User";
import { validateOrigin } from "../../../../../lib/validateOrigin";
import { checkRouteRateLimit } from "../../../../../lib/routeRateLimit";
import {
  generateGuardianToken,
  hashGuardianToken,
} from "../../../../../lib/guardianToken";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
  hashToken,
} from "../../../../../lib/trace/index.js";
import { logSecurityEvent } from "../../../../../lib/securityLogger";

const STUDENT_ID_REGEX = /^[a-f0-9]{24}$/;

// Guardian links must point at the public site. Behind reverse proxies
// req.url resolves to the internal upstream (e.g. http://localhost:3000),
// so the configured public base URL (NEXT_PUBLIC_URL) takes precedence and
// the request origin remains the fallback for unconfigured environments.
function resolvePublicOrigin(req) {
  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Misconfigured value → fall back to the request origin.
    }
  }
  return new URL(req.url).origin;
}

export async function POST(req) {
  return withCaller("api_guardian_generate", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_guardian_generate", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        try {
          const limited = await checkRouteRateLimit(req, "guardianGenerate");
          if (limited) {
            logSecurityEvent("RATE_LIMIT_HIT", { reason: "guardianGenerate" });
            return NextResponse.json(
              { success: false, message: "Too many attempts. Please try again later" },
              { status: 429 }
            );
          }

          const { success, user } = await checkUser();
          if (!success || !user) {
            return NextResponse.json(
              { success: false, message: "Unauthorized" },
              { status: 401 }
            );
          }

          let body = {};
          try {
            body = await req.json();
          } catch {
            body = {};
          }
          const clientStudentId =
            typeof body?.studentId === "string" ? body.studentId : null;

          let targetId;
          if (user.role === "student") {
            targetId = user._id;
          } else if (user.role === "admin" || user.role === "assistant") {
            if (!clientStudentId || !STUDENT_ID_REGEX.test(clientStudentId)) {
              return NextResponse.json(
                { success: false, message: "A valid studentId is required" },
                { status: 400 }
              );
            }
            targetId = clientStudentId;
          } else {
            return NextResponse.json(
              { success: false, message: "Forbidden" },
              { status: 403 }
            );
          }

          await connectToDatabase();

          const targetUser = await User.findOne({
            _id: targetId,
            role: "student",
          }).select("_id");

          if (!targetUser) {
            return NextResponse.json(
              { success: false, message: "Student not found" },
              { status: 404 }
            );
          }

          const plaintextToken = generateGuardianToken();
          const hash = hashGuardianToken(plaintextToken);

          await User.updateOne(
            { _id: targetId },
            { $set: { guardianTokenHash: hash } }
          );

          const url = `${resolvePublicOrigin(req)}/p/${plaintextToken}`;

          return NextResponse.json(
            {
              success: true,
              token: plaintextToken,
              url,
            },
            { status: 200 }
          );
        } catch (error) {
          console.error("Guardian generate error:", error);
          return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
          );
        }
      })
    )
  );
}