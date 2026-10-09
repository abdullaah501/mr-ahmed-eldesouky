import { NextResponse } from "next/server";
import connectToDatabase from "../../../../../lib/connectToDb";
import Grade from "../../../../../models/Grade";
import { validateOrigin } from "../../../../../lib/validateOrigin";
import { checkRouteRateLimit } from "../../../../../lib/routeRateLimit";

// Public, read-only grade listing for unauthenticated selectors (e.g. registration).
// Intentionally narrow: active records only, _id + name only, GET only.
export async function GET(req) {
  try {
    const originError = validateOrigin(req);
    if (originError) return originError;

    const limited = await checkRouteRateLimit(req, "publicGrades");
    if (limited) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later" },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const grades = await Grade.find({ active: true })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, grades }, { status: 200 });
  } catch (error) {
    console.error("Error listing public grades:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error. Please try again" },
      { status: 500 }
    );
  }
}
