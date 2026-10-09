import mongoose from "mongoose";
import { verifyJWT, signJWT } from "./jwt";
import User from "../models/User";
import Session from "../models/Session";
import connectToDatabase from "./connectToDb";
import { logSecurityEvent } from "./securityLogger";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, REFRESH_GRACE_WINDOW_MS, SESSION_TTL_MS } from "./auth/config";
import {
  emit,
  emitRefresh,
  emitMongoStart,
  emitMongoEnd,
  getInvocationId,
  hashToken,
  hashValue,
  tsHr,
  nowIso,
  captureStack,
  runWithContext,
  getTraceContext,
  setContextFields,
} from "./trace/index.js";

/**
 * Shared refresh-token -> access-token flow.
 * Used by lib/checkUser.js and src/app/api/auth/refresh/route.js.
 *
 * Contract (preserved across both call sites):
 *   { success: true, user, newAccessToken }
 *   { success: false, message: "User not authenticated" }
 *
 * The `user` object shape matches login/route.js:72-83 exactly.
 *
 * Security guarantees (additive on top of the existing flow):
 *  - Malformed sessionId is rejected before MongoDB (no CastError, no log noise).
 *  - Session existence + isExp + expiredAt are checked BEFORE refresh JWT verify.
 *  - Refresh JWT is used ONLY for signature, expiration, and identity.
 *  - decoded._id MUST equal session.userId (defense-in-depth).
 *  - User document is the SOLE source of truth for role and profile.
 *  - Deleted users receive no new access tokens.
 *  - Refresh Token Rotation: every successful refresh rotates the refresh token
 *    stored in the Session via an atomic compare-and-swap (CAS). The old refresh
 *    token is invalidated. Replay of the old token triggers session revocation.
 *    EXCEPTION (Phase 2 grace window): a CAS failure whose expected token is the
 *    just-rotated predecessor (or still the unchanged current token) is treated
 *    as a legitimate CONCURRENT refresh — a fresh access token is issued without
 *    rotating again and the session is NOT revoked. Only after the grace window
 *    (REFRESH_GRACE_WINDOW_MS, default 30s) does the predecessor count as replay.
 *  - Token Version: the refresh JWT carries tokenVersion; refresh flow compares
 *    it to User.tokenVersion. Mismatch -> immediate failure.
 *  - All failures are logged via the security logger (non-blocking, never throws).
 */
export async function refreshAuth(sessionId) {
  const invocation_id = getInvocationId();
  const t0 = process.hrtime.bigint();
  setContextFields({ invocation_id, session_id: sessionId || null });
  const stack = captureStack(5);
  emitRefresh("refresh_auth_enter", {
    session_id_param: sessionId || null,
    stack,
  });

  if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
    const dur = Number(process.hrtime.bigint() - t0) / 1e6;
    emitRefresh("refresh_auth_reject", {
      reason: "invalid_session_id",
      session_id_param: sessionId || null,
      duration_ms: dur,
    });
    return { success: false, message: "User not authenticated" };
  }

  try {
    const dbT0 = process.hrtime.bigint();
    emitMongoStart("db_connect", { collection: "_meta" });
    await connectToDatabase();
    const dbDuration = Number(process.hrtime.bigint() - dbT0) / 1e6;
    emitMongoEnd("db_connect", { duration_ms: dbDuration });

    const findT0 = process.hrtime.bigint();
    emitMongoStart("session_findone", { collection: "Session" });
    const session = await Session.findOne({ _id: sessionId })
      .select("refreshToken userId isExp expiredAt expiresAt")
      .lean();
    const findDuration = Number(process.hrtime.bigint() - findT0) / 1e6;
    emitMongoEnd("session_findone", {
      duration_ms: findDuration,
      result: session ? { found: true, _id: sessionId } : null,
    });

    if (!session) {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emitRefresh("refresh_auth_reject", {
        reason: "session_not_found",
        session_id: sessionId,
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }
    const sessionRefreshHash = hashToken(session.refreshToken);
    emitRefresh("mongo_session_findone_end", {
      session_found: true,
      session_refresh_token_hash: sessionRefreshHash,
      session_userId: String(session.userId),
      session_isExp: session.isExp,
      session_expiredAt: session.expiredAt
        ? new Date(session.expiredAt).toISOString()
        : null,
    });
    if (session.isExp === true) {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emitRefresh("refresh_auth_reject", {
        reason: "session_isexp",
        session_id: sessionId,
        session_isExp: true,
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }
    if (session.expiredAt && new Date(session.expiredAt).getTime() <= Date.now()) {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emitRefresh("refresh_auth_reject", {
        reason: "session_expired_at",
        session_id: sessionId,
        session_expiredAt: new Date(session.expiredAt).toISOString(),
        now: new Date().toISOString(),
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }

    // Phase 4: sliding session lifetime. The TTL index auto-deletes the
    // document after expiresAt, but MongoDB's background sweeper runs ~every
    // 60s, so a document whose expiresAt just passed may still be readable
    // here. Reject explicitly to avoid issuing tokens for a logically-expired
    // session.
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emitRefresh("refresh_auth_reject", {
        reason: "session_sliding_expired",
        session_id: sessionId,
        session_expiresAt: new Date(session.expiresAt).toISOString(),
        now: new Date().toISOString(),
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }

    let decoded;
    try {
      emit("jwt_verify_start", { verify_kind: "refresh_token" });
      decoded = await verifyJWT(session.refreshToken);
      emit("jwt_verify_end", {
        verify_kind: "refresh_token",
        verify_ok: true,
        decoded_userId: String(decoded._id),
        decoded_tokenVersion: decoded.tokenVersion ?? 1,
        decoded_role: decoded.role,
        decoded_email: decoded.email,
      });
    } catch {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emit("jwt_verify_end", { verify_kind: "refresh_token", verify_ok: false });
      emitRefresh("refresh_auth_reject", {
        reason: "jwt_verify_failed",
        session_id: sessionId,
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }
    if (!decoded?._id) {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emitRefresh("refresh_auth_reject", {
        reason: "decoded_no_id",
        session_id: sessionId,
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }

    if (String(decoded._id) !== String(session.userId)) {
      emitRefresh("refresh_auth_reject", {
        reason: "jwt_session_mismatch",
        session_id: sessionId,
        decoded_userId: String(decoded._id),
        session_userId: String(session.userId),
        duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
      });
      logSecurityEvent("JWT_SESSION_MISMATCH", { sessionId, userId: String(session.userId) });
      return { success: false, message: "User not authenticated" };
    }

    const userT0 = process.hrtime.bigint();
    emitMongoStart("user_findbyid", { collection: "User" });
    const userDoc = await User.findById(session.userId)
      .select("firstName lastName grade gradeId phone guardianPhone image governorate email role tokenVersion")
      .lean();
    const userDuration = Number(process.hrtime.bigint() - userT0) / 1e6;
    emitMongoEnd("user_findbyid", {
      duration_ms: userDuration,
      result: userDoc ? { found: true, _id: String(userDoc._id) } : null,
    });

    if (!userDoc) {
      const dur = Number(process.hrtime.bigint() - t0) / 1e6;
      emitRefresh("refresh_auth_reject", {
        reason: "user_not_found",
        session_id: sessionId,
        user_id: String(session.userId),
        duration_ms: dur,
      });
      return { success: false, message: "User not authenticated" };
    }

    const dbTokenVersion = userDoc.tokenVersion ?? 1;
    const jwtTokenVersion = decoded.tokenVersion ?? 1;
    if (dbTokenVersion !== jwtTokenVersion) {
      emitRefresh("refresh_auth_reject", {
        reason: "token_version_mismatch",
        session_id: sessionId,
        user_id: String(session.userId),
        db_tokenVersion: dbTokenVersion,
        jwt_tokenVersion: jwtTokenVersion,
        duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
      });
      logSecurityEvent("TOKEN_VERSION_MISMATCH", { userId: String(session.userId), tokenVersion: dbTokenVersion });
      return { success: false, message: "User not authenticated" };
    }

    const user = {
      _id: userDoc._id.toString(),
      role: userDoc.role,
      email: userDoc.email,
      grade: userDoc.grade,
      gradeId: userDoc.gradeId ? String(userDoc.gradeId) : null,
      image: userDoc.image ?? { url: "", cloudId: "" },
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      phone: userDoc.phone,
      guardianPhone: userDoc.guardianPhone,
      governorate: userDoc.governorate,
      tokenVersion: dbTokenVersion,
    };

    emitRefresh("user_built", {
      user_id: user._id,
      user_role: user.role,
    });

    const signRefreshT0 = process.hrtime.bigint();
    emit("sign_jwt_start", { sign_kind: "refresh" });
    const newRefreshToken = await signJWT(user, REFRESH_TOKEN_TTL);
    const signRefreshDuration = Number(process.hrtime.bigint() - signRefreshT0) / 1e6;
    const newRefreshHash = hashToken(newRefreshToken);
    emit("sign_jwt_end", {
      sign_kind: "refresh",
      sign_duration_ms: signRefreshDuration,
      new_refresh_token_hash: newRefreshHash,
    });

    const casT0 = process.hrtime.bigint();
    emitMongoStart("session_cas", {
      collection: "Session",
      cas_filter_refresh_token_hash: sessionRefreshHash,
      cas_new_refresh_token_hash: newRefreshHash,
    });
    const cas = await Session.findOneAndUpdate(
      {
        _id: sessionId,
        refreshToken: session.refreshToken,
        isExp: { $ne: true },
      },
      {
        $set: {
          refreshToken: newRefreshToken,
          previousRefreshToken: session.refreshToken,
          previousRefreshTokenExpiresAt: new Date(Date.now() + REFRESH_GRACE_WINDOW_MS),
          // Phase 4: slide the session lifetime forward on every successful
          // rotation. The TTL index on this field (expireAfterSeconds=0)
          // deletes the document when expiresAt falls into the past.
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      },
      { new: true }
    );
    const casDuration = Number(process.hrtime.bigint() - casT0) / 1e6;
    emitMongoEnd("session_cas", {
      duration_ms: casDuration,
      result: cas ? { matchedCount: 1, modifiedCount: 1 } : { matchedCount: 0, modifiedCount: 0 },
    });

    if (!cas) {
      // ── CAS failure classification ────────────────────────────────────────
      // A CAS failure means the DB's refreshToken changed (or the session was
      // revoked) between our read and our update. Classify it:
      //
      //   1. Session gone/revoked/expired            → failure (no new revoke needed)
      //   2. DB refreshToken unchanged (== ours)     → transient race → success
      //      WITHOUT rotation (the presented token IS the current valid one)
      //   3. DB previousRefreshToken == ours AND its grace window is still
      //      open                                   → legitimate concurrent-refresh
      //      loser (another request just rotated our token) → success WITHOUT
      //      rotation — do NOT revoke
      //   4. anything else                           → genuine replay/stale read
      //      → revoke the session (pre-Phase-2 behavior)
      let reread = null;
      let actualDbHash = null;
      try {
        emitMongoStart("session_findone_after_cas_fail", { collection: "Session" });
        const rereadT0 = process.hrtime.bigint();
        reread = await Session.findOne({ _id: sessionId })
          .select("refreshToken previousRefreshToken previousRefreshTokenExpiresAt isExp expiredAt")
          .lean();
        const rereadDuration = Number(process.hrtime.bigint() - rereadT0) / 1e6;
        emitMongoEnd("session_findone_after_cas_fail", {
          duration_ms: rereadDuration,
          result: reread ? { found: true } : null,
        });
        if (reread) actualDbHash = hashToken(reread.refreshToken);
      } catch {
      }

      const nowMs = Date.now();
      const rereadStillValid =
        reread &&
        reread.isExp !== true &&
        !(reread.expiredAt && new Date(reread.expiredAt).getTime() <= nowMs);
      const isUnchangedCurrent = rereadStillValid && reread.refreshToken === session.refreshToken;
      const isGracePredecessor =
        rereadStillValid &&
        reread.previousRefreshToken === session.refreshToken &&
        reread.previousRefreshTokenExpiresAt &&
        new Date(reread.previousRefreshTokenExpiresAt).getTime() > nowMs;

      if (isUnchangedCurrent || isGracePredecessor) {
        // Legitimate concurrent refresh: another in-flight request already
        // rotated (or is rotating) the session. Issue a fresh access token
        // WITHOUT rotating again — rotating here would cascade CAS failures
        // onto other losers and could revoke the session.
        emitRefresh("refresh_auth_grace_hit", {
          reason: isGracePredecessor ? "concurrent_loser_predecessor" : "concurrent_loser_unchanged_current",
          session_id: sessionId,
          user_id: String(session.userId),
          expected_old_refresh_token_hash: sessionRefreshHash,
          actual_db_refresh_token_hash_after_cas_fail: actualDbHash,
          cas_attempted: true,
          cas_matched: false,
          grace_window_ms: REFRESH_GRACE_WINDOW_MS,
          rotated_again: false,
          duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
        });

        const graceSignT0 = process.hrtime.bigint();
        emit("sign_jwt_start", { sign_kind: "access" });
        const graceAccessToken = await signJWT(user, ACCESS_TOKEN_TTL);
        emit("sign_jwt_end", {
          sign_kind: "access",
          sign_duration_ms: Number(process.hrtime.bigint() - graceSignT0) / 1e6,
          new_access_token_hash: hashToken(graceAccessToken),
        });

        logSecurityEvent("REFRESH_GRACE_HIT", {
          sessionId,
          userId: String(session.userId),
          kind: isGracePredecessor ? "predecessor" : "unchanged_current",
        });

        return { success: true, user, newAccessToken: graceAccessToken };
      }

      emitRefresh("refresh_auth_replay", {
        reason: "cas_failed",
        session_id: sessionId,
        user_id: String(session.userId),
        expected_old_refresh_token_hash: sessionRefreshHash,
        cas_filter_refresh_token_hash: sessionRefreshHash,
        actual_db_refresh_token_hash_after_cas_fail: actualDbHash,
        cas_attempted: true,
        cas_matched: false,
        replay_action: "set_isexp_true_expiredAt_now",
        cas_new_refresh_token_hash: newRefreshHash,
        grace_window_ms: REFRESH_GRACE_WINDOW_MS,
        duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
      });
      try {
        const setExpT0 = process.hrtime.bigint();
        emitMongoStart("session_set_isexp", { collection: "Session" });
        await Session.updateOne(
          { _id: sessionId, isExp: { $ne: true } },
          { $set: { isExp: true, expiredAt: new Date() } }
        );
        const setExpDuration = Number(process.hrtime.bigint() - setExpT0) / 1e6;
        emitMongoEnd("session_set_isexp", {
          duration_ms: setExpDuration,
          result: { matchedCount: 1, modifiedCount: 1 },
        });
      } catch {
      }
      logSecurityEvent("REFRESH_REPLAY_DETECTED", { sessionId, userId: String(session.userId) });
      return { success: false, message: "User not authenticated" };
    }

    const signAccessT0 = process.hrtime.bigint();
    emit("sign_jwt_start", { sign_kind: "access" });
    const newAccessToken = await signJWT(user, ACCESS_TOKEN_TTL);
    const signAccessDuration = Number(process.hrtime.bigint() - signAccessT0) / 1e6;
    const newAccessHash = hashToken(newAccessToken);
    emit("sign_jwt_end", {
      sign_kind: "access",
      sign_duration_ms: signAccessDuration,
      new_access_token_hash: newAccessHash,
    });

    setContextFields({ user_id: String(session.userId) });

    emitRefresh("refresh_auth_success", {
      user_id: String(session.userId),
      old_refresh_token_hash: sessionRefreshHash,
      new_refresh_token_hash: newRefreshHash,
      new_access_token_hash: newAccessHash,
      cas_attempted: true,
      cas_matched: true,
      cas_filter_refresh_token_hash: sessionRefreshHash,
      cas_new_refresh_token_hash: newRefreshHash,
      session_refresh_token_hash: sessionRefreshHash,
      db_tokenVersion: dbTokenVersion,
      jwt_tokenVersion: jwtTokenVersion,
      user_found: true,
      session_found: true,
      session_isExp_before: false,
      set_cookie_emitted: false,
      duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
    });
    emitRefresh("refresh_auth_exit_success", {
      total_duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
    });

    logSecurityEvent("SESSION_ROTATED", { sessionId, userId: String(session.userId) });
    logSecurityEvent("REFRESH_SUCCESS", { userId: String(session.userId) });

    return { success: true, user, newAccessToken };
  } catch (error) {
    emitRefresh("refresh_auth_reject", {
      reason: "exception",
      session_id: sessionId,
      error_message: error.message,
      error_stack_first_200: (error.stack || "").slice(0, 200),
      duration_ms: Number(process.hrtime.bigint() - t0) / 1e6,
    });
    logSecurityEvent("REFRESH_FAILED", { reason: error.message });
    return { success: false, message: "User not authenticated" };
  }
}
