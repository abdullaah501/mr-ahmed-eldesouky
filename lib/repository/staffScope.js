import "server-only";
import Grade from "../../models/Grade";
import { getStaffedGradeIds } from "../services/gradeAuth";

/**
 * Assistant Question Bank scope = GradeStaffAssignment grades. Question.grade
 * stores the grade NAME, so staffed ObjectIds resolve to names with one
 * bounded query. Shared by the repository actions and the export resolver so
 * authorization can never diverge.
 */
export async function getStaffedGradeNames(userId) {
  const staffed = await getStaffedGradeIds(userId);
  if (staffed.length === 0) return [];
  const grades = await Grade.find({ _id: { $in: staffed } })
    .select("name")
    .lean();
  return grades.map((g) => g.name).filter(Boolean);
}
