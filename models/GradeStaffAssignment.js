import mongoose from "mongoose";

const GradeStaffAssignmentSchema = new mongoose.Schema(
  {
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

GradeStaffAssignmentSchema.index({ assistantId: 1, gradeId: 1 }, { unique: true });
GradeStaffAssignmentSchema.index({ gradeId: 1 });

export default (
  mongoose.models.GradeStaffAssignment ||
  mongoose.model("GradeStaffAssignment", GradeStaffAssignmentSchema)
);
