import { cookies } from "next/headers";
import { cache } from "react";
import { verifyJWT } from "./jwt";
import { refreshAuth } from "./refreshAuth";
import {
  emit,
  emitCheckUser,
  hashToken,
  tsHr,
  nowIso,
  captureStack,
  setContextFields,
} from "./trace/index.js";

export default async function checkUser {
  const t0 = process.hrtime.bigint();
  const stack = captureStack(5);
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const sessionId = cookieStore.get("s-i")?.value;

  const accessTokenHash = token ? hashToken(token) : null;
  const sIHash = sessionId ? hashToken(sessionId) : null;

  emitCheckUser("check_user_enter", {
    access_cookie_present: Boolean(token),
    access_cookie_hash: accessTokenHash,
    s_i_cookie_present: Boolean(sessionId),
    s_i_hash: sIHash,
    s_i_value_first8: sessionId ? sessionId.slice(0, 8) : null,
    stack,
  });
  setContextFields({ session_id: sessionId || null });

  if (token) {
    try {
      emit("jwt_verify_start", { verify_kind: "access_token" });
      const decoded = await verifyJWT(token);
      emit("jwt_verify_end", {
        verify_kind: "access_token",
        verify_ok: true,
        decoded_userId: String(decoded._id),
      });
      setContextFields({ user_id: String(decoded._id) });
      emitCheckUser("check_user_exit_success", {
        user_id: String(decoded._id),
        will_call_refresh: false,
        total_duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
      });
      return { success: true, user: decoded };
    } catch {
      emit("jwt_verify_end", { verify_kind: "access_token", verify_ok: false });
      emit("jwt_verify_failed", {
        verify_kind: "access_token",
        will_call_refresh: Boolean(sessionId),
        reason: "access_token_expired_or_invalid",
      });
    }
  }

  if (sessionId) {
    emitCheckUser("check_user_falling_through", {
      will_call_refresh: true,
      reason: "access_invalid_session_present",
    });
    const result = await refreshAuth(sessionId);
    emitCheckUser("check_user_exit_via_refresh", {
      refresh_result_success: result?.success || false,
      new_access_token_present: Boolean(result?.newAccessToken),
      new_access_token_hash: result?.newAccessToken ? hashToken(result.newAccessToken) : null,
      total_duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
    });
    return result;
  }

  emitCheckUser("check_user_exit_failure", {
    reason: "no_session_cookie",
    total_duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
  });
  return { success: false, message: "User not authenticated" };
}

const checkUser = cache(checkUserImpl);

export default checkUser;

