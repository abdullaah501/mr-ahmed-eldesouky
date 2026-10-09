import mongoose, { Schema } from "mongoose";
import Essay from "./Essay";

const submissionSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade" },
    score: {
      correct: { type: Number, default: 0 },
      wrong: { type: Number, default: 0 },
    },
    questionsAnswered: [
      {
        questionId: { type: String, required: true },
        type: { type: String, required: true },
        answer: { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
      }
    ],
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

submissionSchema.index({ student: 1, exam: 1 });
submissionSchema.index({ exam: 1 });

// Note: This hook is for standalone deletion.
submissionSchema.pre("findOneAndDelete", async function (next) {
  const session = this.getOptions().session;
  const docToDelete = await this.model.findOne(this.getFilter());
  if (docToDelete) {
    await Essay.deleteMany({ submissionId: docToDelete._id }, { session });
  }
  next();
});

const Submission = mongoose.models.Submission || mongoose.model("Submission", submissionSchema);
export default Submission;
