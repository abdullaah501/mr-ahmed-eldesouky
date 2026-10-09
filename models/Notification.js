import mongoose from "mongoose";

const NOTIFICATION_TYPES = [
  "new_lecture",
  "new_exam",
  "exam_result",
  "schedule_change",
  "attendance",
  "announcement",
];

const notificationTtlDays = () => {
  const raw = parseInt(process.env.NOTIFICATION_TTL_DAYS, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
};

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  link: { type: String, default: "" },
  readAt: { type: Date, default: null },
  // Internal grouping id: one logical send (grade-wide fan-out or a single
  // targeted notification) stamps all its documents with the same value so
  // admin edit/delete can manage the logical notification. Recipients are
  // unaffected — the fan-out-per-recipient storage model is unchanged.
  groupId: { type: String, default: null },
  createdAt: {
    type: Date,
    default: Date.now,
    // Fan-out-per-recipient model: notifications are temporary UI state and
    // expire silently. TTL is env-configurable (NOTIFICATION_TTL_DAYS).
    expires: notificationTtlDays() * 24 * 60 * 60,
  },
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ groupId: 1 });

export default (
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema)
);
