import { NextResponse } from "next/server";
import checkUser from "../../../../../../lib/checkUser";
import { validateOrigin } from "../../../../../../lib/validateOrigin";
import { checkRouteRateLimit } from "../../../../../../lib/routeRateLimit";
import { resolveExportQuestions } from "../../../../../../lib/repository/exportSelectionService";
import { exportQuestionsDocx } from "../../../../../../lib/repository/exporters/docx";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../../../lib/trace/index.js";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function requireAdminOrAssistant(user) {
  if (!user || (user.role !== "admin" && user.role !== "assistant")) {
    return false;
  }
  return true;
}

export async function POST(req) {
  return withCaller("api_repository_export_docx", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_repository_export_docx", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        // Rate limit before any DB / DOCX work.
        const limited = await checkRouteRateLimit(req, "repositoryExport");
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
        if (!requireAdminOrAssistant(user)) {
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }

        let body;
        try {
          body = await req.json();
        } catch {
          return NextResponse.json(
            { success: false, message: "Invalid request body" },
            { status: 400 }
          );
        }

        try {
          const resolved = await resolveExportQuestions({ user, request: body });
          if (!resolved.success) {
            return NextResponse.json(
              {
                success: false,
                code: resolved.code,
                message: resolved.message,
              },
              { status: resolved.status || 400 }
            );
          }

          const buffer = await exportQuestionsDocx(resolved.questions, {
            includeAnswers: resolved.includeAnswers,
          });

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": DOCX_CONTENT_TYPE,
              "Content-Disposition": 'attachment; filename="questions-export.docx"',
              "Cache-Control": "private, no-store",
            },
          });
        } catch (error) {
          console.error("repository export error:", error);
          return NextResponse.json(
            { success: false, message: "Export failed" },
            { status: 500 }
          );
        }
      })
    )
  );
}
