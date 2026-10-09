// lib/repository/mapper.js — Question document → client DTO (shared by service + strategies)

export function toRepositoryQuestion(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(d._id),
    questionText: d.questionText || "",
    type: d.type || "",
    image: d.image || null,
    correctAnswer: d.correctAnswer || "",
    options: (d.options || []).map((o) => d.type === "fill-blank"
      ? {
        _id: o._id ? String(o._id) : undefined,
        id: o.id || (o._id ? String(o._id) : undefined),
        text: o.text || "",
        isCorrect: !!o.isCorrect,
      }
      : {
        _id: o._id ? String(o._id) : undefined,
        optionText: o.optionText || "",
        valueText: o.valueText || "",
        image: o.image || undefined,
      }),
    config: d.config || {},
    difficulty: d.difficulty || null,
    category: d.category || null,
    tags: d.tags || [],
    estimatedTime: d.estimatedTime || null,
    createdBy: d.createdBy ? String(d.createdBy) : null,
    status: d.status || "active",
    grade: d.grade || null,
    subject: d.subject || null,
    unit: d.unit || null,
    topic: d.topic || null,
    source: d.source || "manual",
    importSource: d.importSource || null,
    aiProvider: d.aiProvider || null,
    aiModel: d.aiModel || null,
    version: d.version || 1,
    usageCount: d.usageCount || 0,
    lastUsedAt: d.lastUsedAt || null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}
