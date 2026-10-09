import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import User from "../../../../../models/User";
import connectToDatabase from "../../../../../lib/connectToDb";
import { storeOtp, isValidEmail } from "../../../../../lib/otp";
import {
  checkRateLimit,
  incrementRateLimit,
} from "../../../../../lib/rateLimit";

// ── TASK 2: module-scoped singleton so the connection pool is reused
// across all requests rather than being rebuilt on every call. ──────────────
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 10,
});

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email address" },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("host");

    const [globalCheck, ipCheck] = await Promise.all([
      checkRateLimit({
        service: "send-code",
        key: "global",
        limit: 100,
        windowSeconds: 60,
      }),
      checkRateLimit({
        service: "send-code",
        key: ip,
        limit: 5,
        windowSeconds: 60,
      }),
    ]);

    if (!globalCheck.allowed || !ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later" },
        { status: 429 }
      );
    }

    // ── TASK 1: verify user exists before touching OTP or SMTP ───────────
    // Normalize before querying so casing differences don't bypass this check.
    const normalizedEmail = email.trim().toLowerCase();

    await connectToDatabase();
    const userExists = await User.exists({ email: normalizedEmail });

    if (!userExists) {
      // Anti-enumeration: return an identical success response after a delay
      // that approximates the cost of the real flow (DB + Memcached + SMTP).
      // No OTP is generated, stored, or emailed.
      await new Promise((resolve) => setTimeout(resolve, 300));
      return NextResponse.json(
        { success: true, message: "A verification code has been sent to your email" },
        { status: 200 }
      );
    }

    const otp = await storeOtp({ email });

    if (!otp) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A verification code was already sent. Please wait before requesting a new one",
        },
        { status: 429 }
      );
    }

    await Promise.all([
      incrementRateLimit({
        service: "send-code",
        key: "global",
        windowSeconds: 60,
      }),
      incrementRateLimit({
        service: "send-code",
        key: ip,
        windowSeconds: 60,
      }),
    ]);

    await sendEmail(email, otp);

    return NextResponse.json(
      { success: true, message: "A verification code has been sent to your email" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending verification code:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error. Please try again" },
      { status: 500 }
    );
  }
}

async function sendEmail(to, code) {
  const mailOptions = {
    from: `"منصة أ. أحمد الدسوقي" <${process.env.EMAIL_USER}>`,
    to,
    subject: "كود التحقق الخاص بك",
    text: `كود التحقق الخاص بك هو: ${code}. صالح لمدة 5 دقائق.`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending error:", error);
  }
}

