import { NextResponse } from "next/server";
import { refreshAuth } from "../../../../../lib/refreshAuth";
import {
  ACCESS_TOKEN_COOKIE_MAX_AGE,
  SESSION_COOKIE_MAX_AGE,
  serializeAccessCookie,
  serializeSessionCookie,
} from "../../../../../lib/auth/config";
import { checkRouteRateLimit } from "../../../../../lib/routeRateLimit";
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
  tsHr,
  nowIso,
} from "../../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_refresh", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_refresh", async () => {
        setContextFields({ caller_kind: "axios_interceptor_or_manual" });
        const limited = await checkRouteRateLimit(req, "refresh");
        if (limited) {
          logSecurityEvent("RATE_LIMIT_HIT", { reason: "refresh" });
          emit("rate_limit_hit", { reason: "refresh" });
          return NextResponse.json(
            { message: "Too many attempts. Please try again later" },
            { status: 429 }
          );
        }

        const sessionId = req.cookies.get("s-i")?.value;
        setContextFields({ session_id: sessionId || null });
        const beforeSipHash = sessionId ? hashToken(sessionId) : null;
        const beforeAccessHash = (() => {
          try {
            const c = req.cookies.get("access_token")?.value;
            return c ? hashToken(c) : null;
          } catch {
            return null;
          }
        })();
        emitCookie("cookie_state_before", {
          access_token_present: Boolean(beforeAccessHash),
          access_token_hash: beforeAccessHash,
          s_i_present: Boolean(sessionId),
          s_i_hash: beforeSipHash,
        });

        const result = await refreshAuth(sessionId);

        if (!result.success) {
          emit("refresh_route_401", { session_id_present: Boolean(sessionId) });
          return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        const response = NextResponse.json({ message: "Refreshed successfully", newAccessToken: result.newAccessToken });
        response.headers.set("Set-Cookie", serializeAccessCookie(result.newAccessToken));

        // Phase 4: slide the session cookie so an active user is never logged
        // out at the original login boundary. The s-i value (Session._id) is
        // immutable; only its maxAge moves forward.
        if (sessionId) {
          response.headers.append("Set-Cookie", serializeSessionCookie(sessionId));
        }

        const newAccessHash = hashToken(result.newAccessToken);
        emitCookie("cookie_state_after", {
          refresh_success: true,
          new_access_token_present: true,
          new_access_token_hash: newAccessHash,
          new_access_token_max_age: ACCESS_TOKEN_COOKIE_MAX_AGE,
          response_set_cookie_will_include_access_token: true,
          response_set_cookie_access_token_hash: newAccessHash,
          response_set_cookie_access_token_max_age: ACCESS_TOKEN_COOKIE_MAX_AGE,
          response_set_cookie_will_include_s_i: Boolean(sessionId),
          response_set_cookie_s_i_max_age: SESSION_COOKIE_MAX_AGE,
        });
        emit("set_cookie_written", {
          cookie: "access_token",
          max_age: ACCESS_TOKEN_COOKIE_MAX_AGE,
          cookie_value_hash: newAccessHash,
        });

        return response;
      })
    )
  );
}
