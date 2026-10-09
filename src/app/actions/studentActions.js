"use server";

import Grade from "../../../models/Grade";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import { getUserGradeIds } from "../../../lib/services/gradeAuth";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

/** Student home: the student's own profile Grade (active only). */
export async function getMyGrades() {
  return withCaller("action_my_grades", () =>
    withTracePhase("server_action", async () => {
      const { success, user } = await checkUser();
      if (!success || !user) {
        return { success: false, message: "Unauthorized" };
      }

      await connectToDatabase();

      const ids = await getUserGradeIds(user._id, user.gradeId);
      const grades = ids.length
        ? await Grade.find({ _id: { $in: ids }, active: true })
            .select("_id name")
            .sort({ createdAt: 1 })
            .lean()
        : [];

      return {
        success: true,
        data: JSON.parse(JSON.stringify(grades)),
        profileGrade: user.grade || "",
      };
    })
  );
}
