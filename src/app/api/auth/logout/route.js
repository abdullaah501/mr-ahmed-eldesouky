import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revokeSession } from "../../../../../lib/services/sessionService";
import { serializeClearedAccessCookie, serializeClearedSessionCookie } from "../../../../../lib/auth/config";
import { logSecurityEvent } from "../../../../../lib/securityLogger";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
  setContextFields,
  emit,
  emitHttp,
  emitCookie,
  hashToken,
  nowIso,
} from "../../../../../lib/trace/index.js";

async function performLogout(sessionId) {
  if (sessionId && mongoose.isValidObjectId(sessionId)) {
    await revokeSession(sessionId);
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully" });

  response.headers.set("Set-Cookie", serializeClearedAccessCookie());

  response.headers.append("Set-Cookie", serializeClearedSessionCookie());

  emitCookie("cookie_state_after", {
    refresh_success: false,
    new_access_token_present: false,
    response_set_cookie_will_include_access_token: true,
    response_set_cookie_access_token_max_age: 0,
    response_set_cookie_s_i_max_age: 0,
    action: "logout_clear",
  });

  logSecurityEvent("LOGOUT", {
    sessionId: sessionId && mongoose.isValidObjectId(sessionId) ? sessionId : undefined,
  });

  return response;
}

export async function POST(req) {
  return withCaller("api_logout_post", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_logout_post", async () => {
        const sessionId = req.cookies.get("s-i")?.value;
        setContextFields({ session_id: sessionId || null });
        return performLogout(sessionId);
      })
    )
  );
}

