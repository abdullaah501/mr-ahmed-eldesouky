import { NextResponse } from "next/server";
import {
  verifyOtp,
  storeResetToken,
  isValidEmail,
  isValidOtp,
} from "../../../../../lib/otp";
import {
  checkRateLimit,
  incrementRateLimit,
} from "../../../../../lib/rateLimit";

export async function POST(req) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: "Email and verification code are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email) || !isValidOtp(otp)) {
      return NextResponse.json(
        { success: false, message: "Invalid email or verification code" },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("host");

    const [globalCheck, ipCheck] = await Promise.all([
      checkRateLimit({
        service: "verify-code",
        key: "global",
        limit: 100,
        windowSeconds: 60,
      }),
      checkRateLimit({
        service: "verify-code",
        key: ip,
        limit: 10,
        windowSeconds: 60,
      }),
    ]);

    if (!globalCheck.allowed || !ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later" },
        { status: 429 }
      );
    }

    const result = await verifyOtp({ email, otp });

    if (!result.success) {
      const status = result.code === "MAX_ATTEMPTS" ? 429 : 400;
      return NextResponse.json(
        { success: false, message: "Verification code is incorrect or expired" },
        { status }
      );
    }

    const resetToken = await storeResetToken({ email });

    await Promise.all([
      incrementRateLimit({
        service: "verify-code",
        key: "global",
        windowSeconds: 60,
      }),
      incrementRateLimit({
        service: "verify-code",
        key: ip,
        windowSeconds: 60,
      }),
    ]);

    const response = NextResponse.json(
      {
        success: true,
        message: "Verified successfully",
        resetToken,
      },
      { status: 200 }
    );

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error. Please try again" },
      { status: 500 }
    );
  }
}
