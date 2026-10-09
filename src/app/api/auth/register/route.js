import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import User from "../../../../../models/User";
import Grade from "../../../../../models/Grade";
import Session from "../../../../../models/Session";
import connectToDatabase from "../../../../../lib/connectToDb";
import { signJWT } from "../../../../../lib/jwt";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  ACCESS_TOKEN_COOKIE_MAX_AGE,
  SESSION_COOKIE_MAX_AGE,
  SESSION_TTL_MS,
  serializeAccessCookie,
  serializeSessionCookie,
} from "../../../../../lib/auth/config";
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
  return withCaller("api_register", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_register", async () => {
        const originError = validateOrigin(req);
        if (originError) return originError;

        try {
          await connectToDatabase();

          const {
            firstName,
            lastName,
            gradeId,
            phone,
            guardianPhone,
            governorate,
            email,
            password,
            fingerprint,
          } = await req.json();
          setContextFields({ fingerprint: fingerprint || null });

          // `?mode=admin` only relaxes the Grade requirement — it never
          // affects the created user's role or privileges. Any other mode
          // value is treated as normal registration.
          const mode = new URL(req.url, "http://localhost").searchParams.get("mode");
          const gradeOptional = mode === "admin";

          let gradeFields = {};
          if (gradeId !== undefined && gradeId !== null && gradeId !== "") {
            // The student's Grade comes from the DB-backed selector — the server
            // resolves and validates it, never trusting a client grade string.
            if (typeof gradeId !== "string" || !/^[a-f0-9]{24}$/i.test(gradeId)) {
              return NextResponse.json(
                { message: "A valid grade selection is required" },
                { status: 400 }
              );
            }

            const gradeDoc = await Grade.findById(gradeId)
              .select("_id name active")
              .lean();
            if (!gradeDoc || !gradeDoc.active) {
              return NextResponse.json(
                { message: "The selected grade is not available" },
                { status: 400 }
              );
            }

            gradeFields = { gradeId: gradeDoc._id, grade: gradeDoc.name };
          } else if (!gradeOptional) {
            return NextResponse.json(
              { message: "A valid grade selection is required" },
              { status: 400 }
            );
          }

          const existingUser = await User.findOne({ $or: [{ email }, { phone }] }).lean();

          if (existingUser) {
            return NextResponse.json({ message: "This email or phone number is already registered" }, { status: 400 });
          }

          const hashedPassword = await bcrypt.hash(password, 12);

          const user = await User.create({
            firstName,
            lastName,
            ...gradeFields,
            phone,
            guardianPhone,
            governorate,
            email,
            password: hashedPassword,
          });

          const userToken = {
            _id: user._id.toString(),
            role: user.role,
            email: user.email,
            gradeId: user.gradeId ? String(user.gradeId) : null,
            grade: user.grade ?? null,
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

          const response = NextResponse.json({ message: "Registered successfully" });

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

          logSecurityEvent("REGISTER_SUCCESS", { userId: String(user._id), role: user.role });

          return response;
        } catch (err) {
          console.error("Register Error:", err);
          return NextResponse.json({ message: "Something went wrong while registering" }, { status: 500 });
        }
      })
    )
  );
}
