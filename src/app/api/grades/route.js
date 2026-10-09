import { NextResponse } from "next/server";
import checkUser from "../../../../lib/checkUser";
import { validateOrigin } from "../../../../lib/validateOrigin";
import { checkRouteRateLimit } from "../../../../lib/routeRateLimit";
import { getActiveGrades, getAllGrades } from "../../../../lib/services/grades";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_grades_list", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_grades_list", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        const limited = await checkRouteRateLimit(req, "grades");
        if (limited) {
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

        const { searchParams } = new URL(req.url);
        const includeInactive = searchParams.get("all") === "1" && user.role === "admin";

        const grades = includeInactive ? await getAllGrades() : await getActiveGrades();

        return NextResponse.json({ success: true, data: grades }, { status: 200 });
      })
    )
  );
}