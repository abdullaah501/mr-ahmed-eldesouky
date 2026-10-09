import { describe, it, expect } from "vitest";
import QuizDraft from "../../models/QuizDraft";

describe("QuizDraft model", () => {
  it("enforces exactly one active draft per student + exam", () => {
    const indexes = QuizDraft.schema.indexes();
    const unique = indexes.find(
      ([fields]) => fields.studentId === 1 && fields.examId === 1
    );
    expect(unique).toBeTruthy();
    expect(unique[1]).toMatchObject({ unique: true });
  });

  it("does not add redundant individual indexes or a TTL", () => {
    const indexes = QuizDraft.schema.indexes();
    expect(indexes).toHaveLength(1);
    expect(indexes[0][1].expireAfterSeconds).toBeUndefined();
  });

  it("stores only answers + revision as draft state", () => {
    const paths = Object.keys(QuizDraft.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining(["studentId", "examId", "answers", "revision"])
    );
    expect(paths).not.toEqual(
      expect.arrayContaining(["isCompleted", "score", "essays"])
    );
  });
});
