import { Schema, model, models } from "mongoose";

const essaySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submissionId: { type: Schema.Types.ObjectId, ref: "Submission", required: true },
    essays: [{ 
      questionId: { type: String, required: true },
      question: { type: String, required: true },
      answer: { type: String, required: true },
      image:{
            url: { type: String },
            cloudId: { type: String },
        },
     }],
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

essaySchema.index({ userId: 1, submissionId: 1 });
essaySchema.index({ submissionId: 1 });

const Essay = models.Essay || model("Essay", essaySchema);
export default Essay;
