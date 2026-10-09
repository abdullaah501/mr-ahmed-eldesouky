export function outputRules(ctx) {
  return `الناتج: مصفوفة DraftQuestion[] بصيغة JSON فقط، بدون شرح إضافي.
كل عنصر:
{
  "type": "multiple-choice" | "true-false" | "essay" | "fill-blank" | "matching",
  "questionText": "...",
  "correctAnswer": "...",
  "options": [...] | undefined,
  "config": {...} | undefined,
  "image": null,
  "difficulty": "easy" | "medium" | "hard",
  "grade": "...",
  "subject": "...",
  "tags": [...],
  "_gen": { "bloomLevel": "...", "sourceTopicRef": "...", "confidence": 0.0, "sourceRanges": [...], "rationale": "..." }
}`;
}