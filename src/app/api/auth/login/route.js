import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import User from "../../../../../models/User";
import connectToDatabase from "../../../../../lib/connectToDb";
import { signJWT } from "../../../../../lib/jwt";
import Session from "../../../../../models/Session";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  ACCESS_TOKEN_COOKIE_MAX_AGE,
  SESSION_COOKIE_MAX_AGE,
  SESSION_TTL_MS,
  serializeAccessCookie,
  serializeSessionCookie,
} from "../../../../../lib/auth/config";
import { checkRouteRateLimit } from "../../../../../lib/routeRateLimit";
import { logSecurityEvent } from "../../../../../lib/securityLogger";
import { validateOrigin } from "../../../../../lib/validateOrigin";
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

export async function POST(req) {
  return withCaller("api_login", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_login", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        try {
          const limited = await checkRouteRateLimit(req, "login");
          if (limited) {
            logSecurityEvent("RATE_LIMIT_HIT", { reason: "login" });
            emit("rate_limit_hit", { reason: "login" });
            return NextResponse.json(
              { message: "Too many attempts. Please try again later" },
              { status: 429 }
            );
          }

          await connectToDatabase();

          const { emailOrPhone, password, fingerprint } = await req.json();
          setContextFields({ fingerprint: fingerprint || null });

          const user = await User.findOne({
            $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
          }).lean();

          if (!user) {
            logSecurityEvent("LOGIN_FAILED", { reason: "no_user" });
            return NextResponse.json(
              { message: "Account not found" },
              { status: 401 }
            );
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            logSecurityEvent("LOGIN_FAILED", { userId: String(user._id), reason: "bad_password" });
            return NextResponse.json(
              { message: "Incorrect password" },
              { status: 401 }
            );
          }

          // Check existing sessions for this user
          const existingSessions = await Session.find({
            userId: user._id,
            isExp: { $ne: true }
          });

          if (existingSessions.length > 0) {
            const sessionsWithDifferentFingerprint = existingSessions.filter(
              session => session.fingerprint !== fingerprint
            );

            if (sessionsWithDifferentFingerprint.length > 0) {
              await Session.updateMany(
                {
                  _id: { $in: sessionsWithDifferentFingerprint.map(session => session._id) },
                  userId: user._id,
                  fingerprint: { $ne: fingerprint },
                  isExp: { $ne: true }
                },
                {
                  $set: {
                    isExp: true,
                    expiredAt: new Date()
                  }
                }
              );
            }
          }

          const userToken = {
            _id: user._id.toString(),
            role: user.role,
            email: user.email,
            grade: user.grade,
            gradeId: user.gradeId ? String(user.gradeId) : null,
            image: user.image ?? { url: "", cloudId: "" },
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            guardianPhone: user.guardianPhone,
            governorate: user.governorate,
            tokenVersion: user.tokenVersion ?? 1,
          }

          const accessToken = await signJWT(userToken, ACCESS_TOKEN_TTL);
          const refreshToken = await signJWT(userToken, REFRESH_TOKEN_TTL);

          const resToken = await Session.create({
            userId: user._id,
            refreshToken,
            fingerprint,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });

          if (!resToken) {
            return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
          }

          const { _id } = resToken;
          setContextFields({ session_id: String(_id), user_id: String(user._id) });

          const response = NextResponse.json({
            message: "Logged in successfully",
            role: user.role,
            user: userToken,
          });

          const accessTokenHash = hashToken(accessToken);
          response.headers.set("Set-Cookie", serializeAccessCookie(accessToken));
          emitCookie("cookie_state_after", {
            refresh_success: true,
            new_access_token_present: true,
            new_access_token_hash: accessTokenHash,
            new_access_token_max_age: ACCESS_TOKEN_COOKIE_MAX_AGE,
            response_set_cookie_will_include_access_token: true,
            response_set_cookie_access_token_hash: accessTokenHash,
            response_set_cookie_s_i_hash: hashToken(String(_id)),
            response_set_cookie_s_i_max_age: SESSION_COOKIE_MAX_AGE,
          });

          response.headers.append("Set-Cookie", serializeSessionCookie(String(_id)));

          logSecurityEvent("LOGIN_SUCCESS", { userId: String(user._id), role: user.role });

          return response;
        } catch (error) {
          console.error("Login error:", error);
          return NextResponse.json(
            { message: "Login failed" },
            { status: 500 }
          );
        }
      })
    )
  );
}
