import mongoose from "mongoose";

// Standalone class-timetable entity — an appointment for a Grade.
// It is NOT a Lecture: no recording, files, or publish state, and creating
// one never creates a Lecture. Times are stored as absolute Date values;
// their business timezone (Africa/Cairo) is handled in lib/schedule/time.js.
const scheduleEventSchema = new mongoose.Schema({
  gradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Grade",
    required: true,
  },
  title: { type: String, required: true, trim: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },
  mode: {
    type: String,
    enum: ["offline", "online"],
    required: true,
  },
  // offline only
  location: {
    name: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  // online only — a plain external meeting link; nothing is ever started.
  onlineUrl: { type: String, default: "" },
  // Recurrence rule stored ONCE. Weekly occurrences are computed at read
  // time inside the requested display window — never materialized.
  recurrence: {
    type: { type: String, enum: ["once", "weekly"], default: "once" },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

scheduleEventSchema.index({ gradeId: 1, startAt: 1 });

export default (
  mongoose.models.ScheduleEvent ||
  mongoose.model("ScheduleEvent", scheduleEventSchema)
);
