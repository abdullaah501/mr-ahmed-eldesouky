import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

gradeSchema.index({ name: 1 }, { unique: true });
gradeSchema.index({ active: 1 });

export default mongoose.models.Grade || mongoose.model("Grade", gradeSchema);
