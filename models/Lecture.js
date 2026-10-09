import mongoose from "mongoose";

const lectureSchema = new mongoose.Schema(
  {
    gradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    thumbnail: {
      url: { type: String },
      cloudId: { type: String },
    },
    files: [
      {
        name: { type: String },
        url: { type: String },
        cloudId: { type: String },
      },
    ],
    recording: {
      provider: { type: String, enum: ["youtube", "zoom"], default: null },
      youtubeVideoId: { type: String, default: null },
      embedUrl: { type: String, default: null },
      originalUrl: { type: String, default: null },
      title: { type: String, default: null },
    },
    scheduledFor: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published"],
      default: "draft",
    },
    publishedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

lectureSchema.index({ gradeId: 1, status: 1, scheduledFor: -1 });

export default (
  mongoose.models.Lecture || mongoose.model("Lecture", lectureSchema)
);
