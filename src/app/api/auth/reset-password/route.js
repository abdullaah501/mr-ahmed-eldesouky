import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import User from "../../../../../models/User";
import connectToDatabase from "../../../../../lib/connectToDb";
import {
  consumeResetToken,
  isValidResetToken,
  isValidEmail,
  hashEmail,
} from "../../../../../lib/otp";
import { isRateLimited } from "../../../../../lib/isRateLimited";
import { revokeUserSessions } from "../../../../../lib/services/sessionService";
import { logSecurityEvent } from "../../../../../lib/securityLogger";
import { validateOrigin } from "../../../../../lib/validateOrigin";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
  setContextFields,
  emit,
  nowIso,
} from "../../../../../lib/trace/index.js";

export async function POST(req) {
  return withCaller("api_reset_password", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_reset_password", async () => {
  const originError = validateOrigin(req);
  if (originError) return originError;

  try {
    await connectToDatabase();

    const { resetToken, password, confirmPassword } = await req.json();

    if (!resetToken || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "All fields are required" },
        { status: 400 }
      );
    }

    if (!isValidResetToken(resetToken)) {
      return NextResponse.json(
        { success: false, message: "Invalid reset token" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Password and confirmation do not match" },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("host");

    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    if (await isRateLimited(tokenHash, ip)) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later" },
        { status: 429 }
      );
    }

    const email = await consumeResetToken({ token: resetToken });

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Reset token is invalid or expired",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { password: hashedPassword }, $inc: { tokenVersion: 1 } },
      { projection: { _id: 1 } }
    );

    if (!user || !user._id) {
      console.warn(
        `[reset-password] user not found for valid token, email hash: ${hashEmail(normalizedEmail)}`
      );
      return NextResponse.json(
        { success: true, message: "Password changed successfully" },
        { status: 200 }
      );
    }

    try {
      await revokeUserSessions(user._id);
    } catch (err) {
      console.warn(
        "[reset-password] session invalidation failed",
        err.message
      );
    }

    logSecurityEvent("PASSWORD_CHANGED", { userId: String(user._id) });

    return NextResponse.json(
      { success: true, message: "Password changed successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Reset Password Error:", err);
    return NextResponse.json(
      { success: false, message: "Something went wrong while changing your password" },
      { status: 500 }
    );
  }
      })
    )
  );
}
