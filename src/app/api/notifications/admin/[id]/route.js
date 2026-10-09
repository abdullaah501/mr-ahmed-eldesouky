import { NextResponse } from "next/server";
import checkUser from "../../../../../../lib/checkUser";
import connectToDatabase from "../../../../../../lib/connectToDb";
import {
  updateNotificationsForAdmin,
  deleteNotificationsForAdmin,
} from "../../../../../../lib/services/notificationService";
import { validateOrigin } from "../../../../../../lib/validateOrigin";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../../../lib/trace/index.js";

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

async function requireAdmin() {
  const { success, user } = await checkUser();
  if (!success || !user) {
    return { error: "Unauthorized", status: 401 };
  }
  if (user.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }
  return { user };
}

/**
 * Admin-only edit/delete of a logical notification. `grouped=true` targets
 * every document of one fan-out (by groupId); legacy ungrouped documents
 * are targeted by their own _id. Students/assistants are rejected
 * server-side regardless of UI.
 */
export async function PATCH(req, { params }) {
  return withCaller("api_notifications_admin_update", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_notifications_admin_update", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        const { error, status, user } = await requireAdmin();
        if (error) {
          return NextResponse.json(
            { success: false, message: error },
            { status }
          );
        }

        const { id } = await params;
        if (!isValidId(id)) {
          return NextResponse.json(
            { success: false, message: "Invalid id" },
            { status: 400 }
          );
        }

        let body = {};
        try {
          body = await req.json();
        } catch {
          body = {};
        }

        const patch = {};
        if (body?.title !== undefined) {
          if (
            typeof body.title !== "string" ||
            body.title.trim().length < 2 ||
            body.title.length > 120
          ) {
            return NextResponse.json(
              { success: false, message: "Notification title is required" },
              { status: 400 }
            );
          }
          patch.title = body.title.trim();
        }
        if (body?.body !== undefined) {
          patch.body = typeof body.body === "string" ? body.body.slice(0, 500) : "";
        }
        if (body?.link !== undefined) {
          patch.link =
            typeof body.link === "string" && body.link.startsWith("/")
              ? body.link.slice(0, 300)
              : "";
        }
        if (Object.keys(patch).length === 0) {
          return NextResponse.json(
            { success: false, message: "No changes" },
            { status: 400 }
          );
        }

        const { searchParams } = new URL(req.url);
        const grouped = searchParams.get("grouped") === "1";

        await connectToDatabase();
        const res = await updateNotificationsForAdmin(id, grouped, patch);

        return NextResponse.json(
          { success: true, data: res },
          { status: 200 }
        );
      })
    )
  );
}

export async function DELETE(req, { params }) {
  return withCaller("api_notifications_admin_delete", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_notifications_admin_delete", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        const { error, status } = await requireAdmin();
        if (error) {
          return NextResponse.json(
            { success: false, message: error },
            { status }
          );
        }

        const { id } = await params;
        if (!isValidId(id)) {
          return NextResponse.json(
            { success: false, message: "Invalid id" },
            { status: 400 }
          );
        }

        const { searchParams } = new URL(req.url);
        const grouped = searchParams.get("grouped") === "1";

        await connectToDatabase();
        const res = await deleteNotificationsForAdmin(id, grouped);

        return NextResponse.json(
          { success: true, data: res },
          { status: 200 }
        );
      })
    )
  );
}
