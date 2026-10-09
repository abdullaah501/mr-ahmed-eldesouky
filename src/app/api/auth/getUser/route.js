import { NextResponse } from "next/server";
import User from "../../../../../models/User";
import connectToDatabase from "../../../../../lib/connectToDb";
import { verifyJWT } from "../../../../../lib/jwt";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
  setContextFields,
  emit,
  hashToken,
  nowIso,
} from "../../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_get_user", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_get_user", async () => {
        try {
          await connectToDatabase();
          const token = req.cookies.get("access_token")?.value;
          emit("get_user_check_token", { access_token_present: Boolean(token), access_token_hash: token ? hashToken(token) : null });
          if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

          const decoded = await verifyJWT(token);
          setContextFields({ user_id: String(decoded._id) });
          const user = await User.findById(decoded._id).select("-password");

          console.log("get user",decoded);
          if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
          }

          return NextResponse.json(user);
        } catch (err) {
          console.error("/api/me error", err);
          return NextResponse.json({ message: "Authentication failed" }, { status: 401 });
        }
      })
    )
  );
}
