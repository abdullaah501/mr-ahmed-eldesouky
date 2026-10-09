import mongoose, { Schema } from "mongoose";
import Submission from "./Submission";

const examSchema = new Schema(
  {
    title: { type: String },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    questionItems: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: "Question" },
        points: { type: Number, default: 1 },
        order: { type: Number },
        required: { type: Boolean, default: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

examSchema.pre("findOneAndDelete", async function (next) {
  const session = this.getOptions().session;
  const docToDelete = await this.model.findOne(this.getFilter());
  if (docToDelete) {
    await Submission.deleteMany({ exam: docToDelete._id }, { session });
  }
  next();
});

const Exam = mongoose.models.Exam || mongoose.model("Exam", examSchema);
export default Exam;
