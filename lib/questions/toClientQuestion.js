export function toClientQuestion(doc) {
  return {
    _id: doc._id,
    questionText: doc.questionText || "",
    type: doc.type || "",
    image: doc.image || null,
    correctAnswer: doc.correctAnswer || "",
    options: (doc.options || []).map((opt) => doc.type === "fill-blank"
      ? {
        _id: opt._id,
        id: opt.id || opt._id,
        text: opt.text || "",
        isCorrect: !!opt.isCorrect,
      }
      : {
        _id: opt._id,
        optionText: opt.optionText || "",
        valueText: opt.valueText || "",
        image: opt.image || undefined,
      }),
    config: doc.config || {},
  };
}
