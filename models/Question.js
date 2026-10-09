import mongoose, { Schema } from "mongoose";

const questionSchema = new Schema(
  {
    questionText: { type: String, required: true },
    type: { type: String, required: true },
    image: {
      url: { type: String },
      cloudId: { type: String },
    },
    correctAnswer: { type: String },
    options: [
      {
        optionText: { type: String },
        valueText: { type: String },
        text: { type: String },
        isCorrect: { type: Boolean },
        image: {
          url: { type: String },
          cloudId: { type: String },
        },
      },
    ],
    config: { type: Schema.Types.Mixed, default: {} },

    difficulty: { type: String },
    category: { type: String },
    tags: { type: [String], default: [] },
    estimatedTime: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "active" },

    grade: { type: String },
    subject: { type: String },
    unit: { type: String },
    topic: { type: String },

    source: { type: String, default: "manual" },
    importSource: { type: String },
    importSourceId: { type: String },
    aiProvider: { type: String },
    aiModel: { type: String },
    aiPromptId: { type: String },
    aiPromptVersion: { type: Number },

    version: { type: Number, default: 1 },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    usedIn: [
      {
        contextType: { type: String },
        contextId: { type: Schema.Types.ObjectId },
      },
    ],

    deletedAt: { type: Date },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ type: 1, status: 1 });
questionSchema.index({ difficulty: 1, status: 1 });
questionSchema.index({ grade: 1, status: 1 });
questionSchema.index({ subject: 1, status: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ createdBy: 1, status: 1 });
questionSchema.index({ source: 1, status: 1 });
questionSchema.index({ usageCount: -1 });
questionSchema.index({ updatedAt: -1 });
questionSchema.index({ updatedAt: -1, _id: -1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index(
  { questionText: "text", "options.optionText": "text" },
  { default_language: "none" }
);
questionSchema.index(
  { importSource: 1, importSourceId: 1 },
  { sparse: true }
);

const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);
export default Question;
