import mongoose from "mongoose";
import Exam from "../../models/Exam";
import Question from "../../models/Question";
import Grade from "../../models/Grade";
import connectToDatabase from "../connectToDb";
import { normalize } from "../../src/question-system/plugins/registry";
import "../../src/question-system/plugins/multiple-choice/core";
import "../../src/question-system/plugins/true-false/core";
import "../../src/question-system/plugins/essay/core";
import "../../src/question-system/plugins/fill-blank/core";
import "../../src/question-system/plugins/matching/core";
import "../../src/question-system/plugins/image-choice/core";
import { getQuestionImageIds } from "./QuestionResolver";

/**
 * Server-side question/class compatibility enforcement.
 * A selected question is compatible when its grade metadata is empty or
 * equals the target Grade name. UI filtering alone is NOT trusted —
 * a malicious client bypassing the UI must not be able to attach an
 * incompatible question to a grade's exam.
 */
async function assertQuestionsCompatible(questionDocs, grade) {
  const offending = [];
  for (const doc of questionDocs) {
    const incomingGrade = typeof doc.grade === "string" ? doc.grade.trim() : null;
    if (incomingGrade && incomingGrade !== grade.name) {
      offending.push(doc.questionText?.slice(0, 40) || doc._id || "question");
      continue;
    }
    if (doc._id) {
      const current = await Question.findById(doc._id)
        .select("grade")
        .lean();
      if (
        current &&
        typeof current.grade === "string" &&
        current.grade.trim() !== "" &&
        current.grade.trim() !== grade.name
      ) {
        offending.push(current._id);
      }
    }
  }
  if (offending.length > 0) {
    throw new Error(
      `Some selected questions are incompatible with grade "${grade.name}" (${offending.length} questions)`
    );
  }
}

async function createOrUpdateQuestion(doc, session) {
  const type = doc.type;
  const normalized = normalize(type, doc);

  if (doc._id) {
    const existing = await Question.findById(doc._id).session(session);
    if (existing) {
      return Question.findByIdAndUpdate(
        doc._id,
        { $set: normalized },
        { new: true, session }
      ).lean();
    }
    return Question.create([{ _id: doc._id, ...normalized }], { session }).then(
      (arr) => arr[0]
    );
  }

  const created = await Question.create([normalized], { session });
  return created[0];
}

async function isQuestionReferenced(questionId, excludeExamId, session) {
  const filter = { "questionItems.questionId": questionId };
  if (excludeExamId) {
    filter._id = { $ne: excludeExamId };
  }
  const count = await Exam.countDocuments(filter).session(session);
  return count > 0;
}

export async function createExamWithQuestions({ gradeId, questions, title }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Questions are required");
  }

  await connectToDatabase();

  const grade = await Grade.findById(gradeId).select("_id name active").lean();
  if (!grade) throw new Error("Grade not found");
  if (!grade.active) throw new Error("The grade is not active");

  const questionDocs = [];
  for (const q of questions) {
    const clean = normalize(q.type, q);
    if (q._id) clean._id = q._id;
    questionDocs.push(clean);
  }

  await assertQuestionsCompatible(questionDocs, grade);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const created = [];
    for (const doc of questionDocs) {
      if (doc._id) {
        const existingQuestion = await Question.findById(doc._id)
          .session(session)
          .lean();
        if (!existingQuestion) {
          throw new Error("One of the selected questions was not found");
        }
        created.push(existingQuestion);
      } else {
        const [newQuestion] = await Question.create([doc], { session });
        created.push(newQuestion);
      }
    }

    const questionItems = created.map((q, i) => ({
      questionId: q._id,
      points: 1,
      order: i,
      required: true,
    }));

    const exam = await Exam.create(
      [
        {
          title: title || undefined,
          gradeId,
          questionItems,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return exam[0].toObject();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

export async function updateExamQuestions(examId, clientQuestions) {
  if (!examId) throw new Error("examId is required");
  if (!Array.isArray(clientQuestions) || clientQuestions.length === 0) {
    throw new Error("Questions are required");
  }

  await connectToDatabase();

  const existing = await Exam.findById(examId)
    .select("questionItems gradeId")
    .lean();

  if (!existing) throw new Error("Exam not found");

  const grade = await Grade.findById(existing.gradeId)
    .select("_id name")
    .lean();
  if (!grade) throw new Error("Failed to load the exam's grade");

  const oldQuestionIds = (existing.questionItems || []).map((item) =>
    String(item.questionId)
  );

  const prepared = [];
  for (const q of clientQuestions) {
    const normalized = normalize(q.type, q);
    const doc = {
      _id: q._id,
      ...normalized,
    };
    prepared.push(doc);
  }

  await assertQuestionsCompatible(prepared, grade);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const created = [];
    for (let i = 0; i < prepared.length; i++) {
      const doc = prepared[i];
      const q = await createOrUpdateQuestion(doc, session);
      created.push(q);
    }

    const questionItems = created.map((q, i) => ({
      questionId: q._id,
      points: 1,
      order: i,
      required: true,
    }));

    await Exam.findByIdAndUpdate(
      examId,
      {
        $set: { questionItems },
        $unset: { questions: "" },
      },
      { session }
    );

    const newIds = new Set(questionItems.map((item) => String(item.questionId)));
    for (const oldId of oldQuestionIds) {
      if (!newIds.has(oldId)) {
        const mongooseId = new mongoose.Types.ObjectId(oldId);
        const refd = await isQuestionReferenced(mongooseId, examId, session);
        if (!refd) {
          const question = await Question.findById(mongooseId)
            .select("image.cloudId")
            .session(session);
          if (question?.image?.cloudId) {
            const { deleteFromStorage } = await import("../deleteFromStorage");
            try {
              await deleteFromStorage(question.image.cloudId);
            } catch (_) {}
          }
          await Question.deleteOne({ _id: mongooseId }, { session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return created;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

export async function deleteExamCascade(examId) {
  if (!examId) return { success: false, message: "examId is required" };

  await connectToDatabase();

  const existing = await Exam.findById(examId)
    .select("gradeId questionItems questions.image")
    .lean();

  if (!existing) return { success: false, message: "Exam not found" };

  const candidateQuestionIds = (existing.questionItems || []).map((item) =>
    String(item.questionId)
  );

  const imageCloudIds = new Set();

  if (existing.questions?.length) {
    for (const q of existing.questions) {
      if (q.image?.cloudId) imageCloudIds.add(q.image.cloudId);
    }
  }

  if (candidateQuestionIds.length) {
    const qImageIds = await getQuestionImageIds(candidateQuestionIds);
    for (const id of qImageIds) imageCloudIds.add(id);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await Exam.findOneAndDelete({ _id: examId }, { session });

    for (const id of candidateQuestionIds) {
      const mongooseId = new mongoose.Types.ObjectId(id);
      const refd = await isQuestionReferenced(mongooseId, null, session);
      if (!refd) {
        await Question.deleteOne({ _id: mongooseId }, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }

  if (imageCloudIds.size > 0) {
    const { deleteMultipleFromStorage } = await import("../deleteFromStorage");
    try {
      await deleteMultipleFromStorage([...imageCloudIds]);
    } catch (_) {}
  }

  return {
    success: true,
    message: "Exam deleted successfully",
    gradeId: existing.gradeId,
  };
}

export async function collectExamImageCloudIds(exam) {
  const cloudIds = [];

  if (exam.questions?.length) {
    for (const q of exam.questions) {
      if (q.image?.cloudId) cloudIds.push(q.image.cloudId);
    }
  }

  if (exam.questionItems?.length) {
    const ids = exam.questionItems.map((item) => String(item.questionId));
    const qImageIds = await getQuestionImageIds(ids);
    cloudIds.push(...qImageIds);
  }

  return cloudIds;
}
