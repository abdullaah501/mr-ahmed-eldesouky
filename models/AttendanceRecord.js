import mongoose from "mongoose";

const ATTENDANCE_STATUSES = ["present", "absent", "late"];

const attendanceRecordSchema = new mongoose.Schema(
  {
    gradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      default: null,
    },
    date: { type: Date, required: true },
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    entries: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        status: {
          type: String,
          enum: ATTENDANCE_STATUSES,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ gradeId: 1, date: -1 });
// Mongo compound unique treats null as a value, so lecture-less sessions
// (lectureId: null) on the same grade+date also dedupe correctly.
attendanceRecordSchema.index(
  { gradeId: 1, date: 1, lectureId: 1 },
  { unique: true }
);

export default (
  mongoose.models.AttendanceRecord ||
  mongoose.model("AttendanceRecord", attendanceRecordSchema)
);
