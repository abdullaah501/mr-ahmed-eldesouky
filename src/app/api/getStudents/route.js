import checkUser from "../../../../lib/checkUser";
import User from "../../../../models/User";
import connectToDatabase from './../../../../lib/connectToDb';
import { withCaller, withHttpTrace, withTracePhase } from "../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("api_get_students", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(req, "api_get_students", async () => {
        const { success, user, newAccessToken } = await checkUser();

        if (!success || !user) {
          return new Response(
            JSON.stringify({ success: false, message: "Unauthorized" }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await connectToDatabase();

        const url = new URL(req.url);

        const page = parseInt(url.searchParams.get("page"), 10) || 1;
        const limit = parseInt(url.searchParams.get("limit"), 10) || 10;
        const rawSearch = url.searchParams.get("search") || "";
        const search = rawSearch.trim().slice(0, 100);
        // Staff assignment selector: search all registered users except
        // admins — excluded server-side, never just hidden in the UI.
        const excludeAdmins = url.searchParams.get("excludeAdmins") === "1";

        const query = excludeAdmins
          ? { role: { $ne: "admin" } }
          : { role: "student" };
        if (search) {
          query.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ];
        }

        const totalStudents = await User.countDocuments(query);

        const totalPages = Math.ceil(totalStudents / limit);

        const students = await User.find(query)
          .select("-password -__v -guardianTokenHash -tokenVersion")
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit);

        return new Response(
          JSON.stringify({
            success: true,
            data: students,
            pagination: {
              currentPage: page,
              totalPages,
              totalStudents,
              limit,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    )
  );
}
