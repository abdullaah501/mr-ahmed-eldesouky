import mongoose, { Schema } from "mongoose";

const quizDraftSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    revision: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Exactly one active draft per student + exam. The compound index is both the
// primary access path and the concurrency guard for duplicate creation.
quizDraftSchema.index({ studentId: 1, examId: 1 }, { unique: true });

const QuizDraft =
  mongoose.models.QuizDraft || mongoose.model("QuizDraft", quizDraftSchema);

export default QuizDraft;
