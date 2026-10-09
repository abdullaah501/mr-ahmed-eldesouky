import { NextResponse } from "next/server";
import checkUser from "../../../../../lib/checkUser";
import connectToDatabase from "../../../../../lib/connectToDb";
import { listNotificationsForAdmin } from "../../../../../lib/services/notificationService";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../../lib/trace/index.js";

/**
 * Admin-only listing of persisted notifications as logical notifications
 * (fan-out documents collapsed by groupId). Not reachable by assistants
 * or students.
 */
export async function GET(req) {
  return withCaller("api_notifications_admin_list", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_notifications_admin_list", async () => {
        const { success, user } = await checkUser();
        if (!success || !user) {
          return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
          );
        }
        if (user.role !== "admin") {
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
        const limit = Math.min(
          50,
          parseInt(searchParams.get("limit"), 10) || 20
        );

        await connectToDatabase();
        const data = await listNotificationsForAdmin({ page, limit });

        return NextResponse.json({ success: true, data }, { status: 200 });
      })
    )
  );
}
