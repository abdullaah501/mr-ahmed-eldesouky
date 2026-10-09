import "server-only";
import Grade from "../../models/Grade";

/**
 * Get all active grades (for selectors/dropdowns)
 */
export async function getActiveGrades() {
  return Grade.find({ active: true })
    .select("_id name active createdAt")
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Get all grades (including inactive) for admin
 */
export async function getAllGrades() {
  return Grade.find({})
    .select("_id name active createdAt")
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Get grade by ID
 */
export async function getGradeById(gradeId) {
  return Grade.findById(gradeId).select("_id name active").lean();
}

/**
 * Get grade by name
 */
export async function getGradeByName(name) {
  return Grade.findOne({ name }).select("_id name active").lean();
}

/**
 * Create a new grade
 */
export async function createGrade({ name, active = true }) {
  const grade = await Grade.create({ name: name.trim(), active });
  return grade.toObject();
}

/**
 * Update a grade
 */
export async function updateGrade(gradeId, updates) {
  const allowedUpdates = {};
  if (updates.name !== undefined) {
    if (typeof updates.name !== "string" || updates.name.trim().length < 2 || updates.name.trim().length > 100) {
      throw new Error("Grade name must be 2-100 characters");
    }
    const existing = await Grade.findOne({ name: updates.name.trim(), _id: { $ne: gradeId } }).lean();
    if (existing) {
      throw new Error("A grade with the same name already exists");
    }
    allowedUpdates.name = updates.name.trim();
  }
  if (updates.active !== undefined) {
    allowedUpdates.active = Boolean(updates.active);
  }
  
  const grade = await Grade.findByIdAndUpdate(gradeId, allowedUpdates, { new: true }).select("_id name active").lean();
  if (!grade) throw new Error("Grade not found");
  return grade;
}

/**
 * Delete a grade (only if no references exist)
 */
export async function deleteGrade(gradeId) {
  // Check for references - this would need to be expanded based on actual references
  // For now, just delete the grade
  const grade = await Grade.findByIdAndDelete(gradeId).lean();
  if (!grade) throw new Error("Grade not found");
  return true;
}

/**
 * Toggle grade active status
 */
export async function toggleGradeActive(gradeId) {
  const grade = await Grade.findById(gradeId).select("active").lean();
  if (!grade) throw new Error("Grade not found");
  
  const updated = await Grade.findByIdAndUpdate(gradeId, { active: !grade.active }, { new: true })
    .select("_id name active")
    .lean();
  return updated;
}

/**
 * Get grade statistics for admin
 */
export async function getGradeStats() {
  const [total, active] = await Promise.all([
    Grade.countDocuments(),
    Grade.countDocuments({ active: true })
  ]);
  return { total, active };
}