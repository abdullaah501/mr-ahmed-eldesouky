import { NextResponse } from "next/server";
import checkUser from "../../../../lib/checkUser";
import connectToDatabase from "../../../../lib/connectToDb";
import User from "../../../../models/User";
import {
  createNotificationsForGrade,
  createNotification,
  listNotifications,
  markNotificationsRead,
} from "../../../../lib/services/notificationService";
import { validateOrigin } from "../../../../lib/validateOrigin";
import { checkRouteRateLimit } from "../../../../lib/routeRateLimit";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../lib/trace/index.js";

const NOTIFICATION_TYPES = [
  "new_lecture",
  "new_exam",
  "exam_result",
  "schedule_change",
  "attendance",
  "announcement",
];

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

export async function GET(req) {
  return withCaller("api_notifications_list", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_notifications_list", async () => {
        const { success, user } = await checkUser();
        if (!success || !user) {
          return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
          );
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
        const limit = Math.min(50, parseInt(searchParams.get("limit"), 10) || 20);

        await connectToDatabase();
        const data = await listNotifications(user._id, { page, limit });

        return NextResponse.json({ success: true, data }, { status: 200 });
      })
    )
  );
}

export async function POST(req) {
  return withCaller("api_notifications_compose", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_notifications_compose", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        const limited = await checkRouteRateLimit(req, "notifications");
        if (limited) {
          return NextResponse.json(
            { success: false, message: "Too many attempts" },
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

        // markRead action
        if (body?.action === "markRead") {
          await connectToDatabase();
          const ids = Array.isArray(body.ids)
            ? body.ids.filter((x) => isValidId(x)).slice(0, 100)
            : null;
          const res = await markNotificationsRead(user._id, ids);
          return NextResponse.json({ success: true, data: res }, { status: 200 });
        }

        // compose (admin only): target grade or single user
        if (user.role !== "admin") {
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }

        const { audienceType, gradeId, studentId, type, title, body: bodyText, link } =
          body || {};
        if (!NOTIFICATION_TYPES.includes(type)) {
          return NextResponse.json(
            { success: false, message: "Invalid notification type" },
            { status: 400 }
          );
        }
        if (typeof title !== "string" || title.trim().length < 2 || title.length > 120) {
          return NextResponse.json(
            { success: false, message: "Notification title is required" },
            { status: 400 }
          );
        }
        const safeBody =
          typeof bodyText === "string" ? bodyText.slice(0, 500) : "";
        const safeLink = typeof link === "string" && link.startsWith("/") ? link : "";

        await connectToDatabase();

        if (audienceType === "grade") {
          if (!isValidId(gradeId)) {
            return NextResponse.json(
              { success: false, message: "Invalid gradeId" },
              { status: 400 }
            );
          }
          const res = await createNotificationsForGrade({
            gradeId,
            type,
            title: title.trim(),
            body: safeBody,
            link: safeLink,
          });
          return NextResponse.json(
            { success: true, data: res },
            { status: 200 }
          );
        }

        if (!isValidId(studentId)) {
          return NextResponse.json(
            { success: false, message: "Invalid studentId" },
            { status: 400 }
          );
        }
        // Server-side target validation: never trust a client-supplied
        // userId — the target must be an actual registered student.
        const target = await User.findById(studentId).select("role").lean();
        if (!target || target.role !== "student") {
          return NextResponse.json(
            { success: false, message: "Student not found" },
            { status: 400 }
          );
        }
        const created = await createNotification({
          userId: studentId,
          type,
          title: title.trim(),
          body: safeBody,
          link: safeLink,
        });
        return NextResponse.json(
          { success: true, data: { id: String(created._id) } },
          { status: 200 }
        );
      })
    )
  );
}
