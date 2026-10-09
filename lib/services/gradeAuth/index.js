import "server-only";
import User from "../../../models/User";
import Grade from "../../../models/Grade";
import GradeStaffAssignment from "../../../models/GradeStaffAssignment";

const DENIED = Object.freeze({
  allowed: false,
  grade: null,
});

async function loadUserGradeId(userId) {
  const doc = await User.findById(userId).select("gradeId").lean();
  return doc?.gradeId ? String(doc.gradeId) : null;
}

/**
 * Single runtime authority for student content access.
 * The student's profile `User.gradeId` is the authorization source: the
 * requested gradeId must equal the authenticated student's gradeId and the
 * target Grade must exist and be active. No grants, codes, or approvals.
 */
export async function resolveGradeAccess({ userId, gradeId, userGradeId }) {
  // `userGradeId` is an optional optimization for callers that already hold
  // the authenticated user's gradeId from the server session — it is never
  // accepted from the client. Without it the value is loaded from the User
  // document (trusted source of truth).
  const gid =
    userGradeId != null ? String(userGradeId) : await loadUserGradeId(userId);
  if (!gid || !gradeId || String(gradeId) !== gid) return DENIED;

  const grade = await Grade.findOne({ _id: gid, active: true })
    .select("_id name")
    .lean();
  if (!grade) return DENIED;
  return { allowed: true, grade };
}

/** The authenticated student's current Grade ids — exactly one (their profile Grade). */
export async function getUserGradeIds(userId, userGradeId) {
  const gid =
    userGradeId != null ? String(userGradeId) : await loadUserGradeId(userId);
  if (!gid) return [];
  const grade = await Grade.findOne({ _id: gid, active: true })
    .select("_id")
    .lean();
  return grade ? [String(grade._id)] : [];
}

/** All student users currently assigned to a Grade (rosters / notification fan-out). */
export async function getStudentIdsForGrade(gradeId) {
  const grade = await Grade.findById(gradeId).select("_id active").lean();
  if (!grade || !grade.active) return [];
  const students = await User.find({ role: "student", gradeId: grade._id })
    .select("_id")
    .lean();
  return students.map((s) => String(s._id));
}

/** Assistant staff check for a single grade. Admins are handled by callers via role. */
export async function isStaff(assistantId, gradeId) {
  const doc = await GradeStaffAssignment.findOne({ assistantId, gradeId })
    .select("_id")
    .lean();
  return !!doc;
}

/** All grade ids an assistant is staffed on. */
export async function getStaffedGradeIds(assistantId) {
  const docs = await GradeStaffAssignment.find({ assistantId })
    .select("gradeId")
    .lean();
  return docs.map((d) => String(d.gradeId));
}
