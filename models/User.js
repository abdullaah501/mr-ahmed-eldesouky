import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    grade: { type: String },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      index: true,
    },
    phone: { type: String, required: true, unique: true },
    guardianPhone: { type: String, required: true },
    image: { type: Object, default: { url: "", cloudId: "" } },
    governorate: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "student", "assistant"], required: true, default: "student" },
    verified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 1 },

    guardianTokenHash: {
      type: String,
      index: { unique: true, sparse: true },
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
