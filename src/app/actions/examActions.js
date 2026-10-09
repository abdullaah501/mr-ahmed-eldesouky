"use server";

import Hashids from "hashids";
import mongoose from "mongoose";
import Exam from "../../../models/Exam";
import Grade from "../../../models/Grade";
import Submission from "../../../models/Submission";
import Essay from "../../../models/Essay";
import checkUser from "../../../lib/checkUser";
import connectToDatabase from "../../../lib/connectToDb";
import { hydrateExams } from "../../../lib/questions/QuestionHydrator";
import {
  createExamWithQuestions,
  updateExamQuestions,
  deleteExamCascade,
} from "../../../lib/questions/examQuestionsService";
import { resolveGradeAccess, isStaff, getStaffedGradeIds } from "../../../lib/services/gradeAuth";
import {
  createNotificationsForGrade,
  createNotification,
} from "../../../lib/services/notificationService";
import {
  getDraft,
  deleteDraft,
  saveDraft,
} from "../../../lib/services/quizDraftService";
import { sanitizeDraftAnswers } from "../../../lib/quizDraft";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

function isValidId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

async function requireStaffOnGrade(user, gradeId) {
  if (user.role === "admin") return true;
  if (user.role === "assistant") return isStaff(user._id, gradeId);
  return false;
}

/**
 * Get one exam for the runner page. Access: admin always; assistant if
 * staffed on the exam's grade; student when the exam's grade matches their
 * profile User.gradeId (active Grade).
 */
export async function getExam(examId) {
  const { success, user } = await withCaller("server_action_getExam", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
    const realExamId = hashids.decodeHex(examId);

    const raw = await Exam.findById(realExamId, "-__v").lean();
    if (!raw || !raw.gradeId) return { success: false, message: "Exam not found" };

    const gradeIdStr = String(raw.gradeId);

    let allowed = false;
    if (user.role === "admin") {
      allowed = true;
    } else if (user.role === "assistant") {
      allowed = await isStaff(user._id, gradeIdStr);
    } else {
      const access = await resolveGradeAccess({
        userId: user._id,
        gradeId: gradeIdStr,
        userGradeId: user.gradeId,
      });
      allowed = access.allowed;
    }
    if (!allowed) {
      return { success: false, message: "Not authorized to access this exam" };
    }

    const [hydrated] = await hydrateExams([raw]);
    const exam = JSON.parse(JSON.stringify(hydrated));

    const grade = await Grade.findById(raw.gradeId).select("name").lean();

    // Drafts ride the existing student-facing getExam path. Only students pay
    // for the extra query; admin/assistant analytics callers do not.
    let draft = null;
    if (user.role === "student") {
      const doc = await getDraft(user._id, raw._id);
      if (doc) {
        draft = {
          answers: doc.answers || {},
          revision: doc.revision || 0,
        };
      }
    }

    return {
      success: true,
      exam,
      draft,
      context: { type: "grade", gradeId: gradeIdStr, gradeName: grade?.name || "" },
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Error fetching exam" };
  }
}

/**
 * Revision-guarded draft save. Student identity comes from the session only;
 * answer keys are restricted to the exam's current Question ids.
 */
export async function saveQuizDraft({ examId, baseRevision, answers }) {
  const { success, user } = await withCaller("server_action_saveQuizDraft", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !user || user.role !== "student") {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(examId)) {
    return { success: false, message: "Invalid examId" };
  }
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    return { success: false, message: "Invalid baseRevision" };
  }

  try {
    await connectToDatabase();

    // Only gradeId + question ids are needed — never the full exam document.
    const exam = await Exam.findById(examId)
      .select("gradeId questionItems.questionId")
      .lean();
    if (!exam || !exam.gradeId) {
      return { success: false, message: "Exam not found" };
    }

    const access = await resolveGradeAccess({
      userId: user._id,
      gradeId: String(exam.gradeId),
      userGradeId: user.gradeId,
    });
    if (!access.allowed) {
      return { success: false, message: "Not authorized to access this exam" };
    }

    const questionIds = (exam.questionItems || [])
      .map((item) => (item.questionId ? String(item.questionId) : null))
      .filter(Boolean);

    const result = await saveDraft({
      studentId: user._id,
      examId,
      baseRevision,
      answers: sanitizeDraftAnswers(answers, questionIds),
    });

    if (result.status === "saved") {
      return { success: true, revision: result.revision };
    }
    if (result.status === "submitted") {
      return { success: true, submitted: true };
    }
    return {
      success: false,
      conflict: true,
      draft: result.draft
        ? {
            answers: result.draft.answers || {},
            revision: result.draft.revision || 0,
          }
        : null,
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Error saving draft" };
  }
}

/** List exams of one grade (access-checked). Bounded: page/limit, max 100. */
export async function getExams(gradeId, options = {}) {
  const { success, user } = await withCaller("server_action_getExams", () =>
    withTracePhase("server_action", () => checkUser())
  );
  if (!success || !user) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(gradeId)) {
    return { success: false, message: "Invalid gradeId" };
  }

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 50));

  try {
    await connectToDatabase();

    if (user.role === "student") {
      const access = await resolveGradeAccess({
        userId: user._id,
        gradeId,
        userGradeId: user.gradeId,
      });
      if (!access.allowed) {
        return { success: false, message: "Unauthorized" };
      }
    }

    const filter = { gradeId };
    const raws = await Exam.find(filter, "-__v")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const hydrated = raws.length ? await hydrateExams(raws) : [];
    let exams = JSON.parse(JSON.stringify(hydrated));

    // Attempt status for the CURRENT authenticated student — resolved with
    // one bounded query over the page's exam ids (no N+1). The student id
    // always comes from the session, never from the client.
    if (user.role === "student" && exams.length > 0) {
      const examIds = exams.map((e) => e._id);
      const attempts = await Submission.find({
        student: user._id,
        exam: { $in: examIds },
        isCompleted: true,
      })
        .select("exam")
        .lean();
      const attempted = new Set(attempts.map((a) => String(a.exam)));
      exams = exams.map((e) => ({
        ...e,
        hasAttempted: attempted.has(String(e._id)),
      }));
    }

    const total = await Exam.countDocuments(filter);

    // Assistants only see exams of staffed grades; admins see all.
    if (user.role === "assistant") {
      const staffed = await getStaffedGradeIds(user._id);
      if (!staffed.includes(String(gradeId))) {
        return { success: true, data: [], pagination: { page, limit, total: 0 } };
      }
    }

    return {
      success: true,
      data: exams,
      pagination: { page, limit, total },
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Error fetching exams" };
  }
}

export async function addExam({ gradeId, questions, title }) {
  const { success, user } = await withCaller("server_action_addExam", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }
  if (!isValidId(gradeId)) {
    return { success: false, message: "Invalid gradeId" };
  }

  try {
    await connectToDatabase();

    const staffErr = !(await requireStaffOnGrade(user, gradeId));
    if (staffErr) {
      return { success: false, message: "Not authorized for this grade" };
    }

    const exam = await createExamWithQuestions({ gradeId, questions, title });

    // Fan-out runs in the background — exam creation must not block on it
    // and must succeed even if the notification fails.
    void (async () => {
      const grade = await Grade.findById(gradeId).select("name").lean();
      await createNotificationsForGrade({
        gradeId,
        type: "new_exam",
        title: "New exam",
        body: `New exam added${title ? ` "${title}"` : ""}${grade?.name ? ` — ${grade.name}` : ""}`,
        link: `/exam/${(() => {
          const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
          return hashids.encodeHex(String(exam._id));
        })()}`,
      });
    })().catch((error) => {
      console.error("new_exam notification failed:", error);
    });

    return { success: true, exam: JSON.parse(JSON.stringify(exam)) };
  } catch (error) {
    console.log(error);
    return { success: false, message: error?.message || "Error adding exam" };
  }
}

export async function updateExam({ examId, questions }) {
  const { success, user } = await withCaller("server_action_updateExam", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const exam = await Exam.findById(examId).select("gradeId").lean();
    if (!exam) return { success: false, message: "Exam not found" };

    const staffOk = await requireStaffOnGrade(user, String(exam.gradeId));
    if (!staffOk) return { success: false, message: "Not authorized for this grade" };

    await updateExamQuestions(examId, questions);

    // Single authoritative trigger for meaningful exam updates (content
    // change to a live exam). Fan-out runs in the background.
    void (async () => {
      const doc = await Exam.findById(examId).select("gradeId title").lean();
      if (!doc?.gradeId) return;
      await createNotificationsForGrade({
        gradeId: String(doc.gradeId),
        type: "new_exam",
        title: "New exam",
        body: `Exam updated${doc.title ? ` "${doc.title}"` : ""}`,
        link: `/exam/${(() => {
          const hashids = new Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10);
          return hashids.encodeHex(String(examId));
        })()}`,
      });
    })().catch((error) => {
      console.error("new_exam update notification failed:", error);
    });

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: error?.message || "Error updating exam" };
  }
}

export async function removeExam(examId) {
  const { success, user } = await withCaller("server_action_removeExam", () =>
    withTracePhase("server_action", () => checkUser())
  );

  if (!success || !user || (user.role !== "admin" && user.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const exam = await Exam.findById(examId).select("gradeId").lean();
    if (!exam) return { success: false, message: "Exam not found" };

    const staffOk = await requireStaffOnGrade(user, String(exam.gradeId));
    if (!staffOk) return { success: false, message: "Not authorized for this grade" };

    const res = await deleteExamCascade(examId);
    return res;
  } catch (error) {
    console.log(error);
    return { success: false, message: "Error removing exam" };
  }
}

/**
 * Student submits an exam. Authorization is server-side: the exam's
 * gradeId must match the student's profile User.gradeId. gradeId on the
 * submission is derived from the exam, never trusted from the client.
 */
export async function addSubmission(data) {
  const { success, user } = await withCaller(
    "server_action_addSubmission",
    () => withTracePhase("server_action", () => checkUser())
  );

  if (!success || !user) {
    return { success: false, message: "Unauthorized" };
  }

  await connectToDatabase();

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const exam = await Exam.findById(data.exam).select("gradeId").lean();
    if (!exam || !exam.gradeId) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Exam not found" };
    }

    if (user.role !== "admin") {
      const access = await resolveGradeAccess({
        userId: user._id,
        gradeId: String(exam.gradeId),
        userGradeId: user.gradeId,
      });
      if (!access.allowed) {
        await session.abortTransaction();
        session.endSession();
        return { success: false, message: "Not authorized to access this exam" };
      }
    }

    const submissionDoc = { ...data, gradeId: exam.gradeId };
    delete submissionDoc.courseId;
    delete submissionDoc.lessonId;

    const submission = await Submission.create([submissionDoc], { session });

    if (!submission || !submission[0]) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        message: "Error creating a new submission, please try again",
      };
    }

    if (!data?.isCompleted) {
      const essay = await Essay.create(
        [
          {
            userId: user._id,
            submissionId: submission[0]._id,
            essays: data?.essays,
          },
        ],
        { session }
      );

      if (!essay || !essay[0]) {
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          message: "Error creating a new essay, please try again",
        };
      }
    }

    // Atomic transition: a successful submission removes the active draft in
    // the same transaction; aborting rolls both back and keeps the draft.
    await deleteDraft(user._id, exam._id, session);

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: "Submission added successfully",
    };
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    session.endSession();
    return {
      success: false,
      message: "Error adding submission",
    };
  }
}

/**
 * Admin/assistant grades essay answers. Assistant must be staffed on the
 * exam's grade. Notifies the student that their result was published.
 */
export async function updateSubmission({ submissionId, ...data }) {
  const { success, user } = await withCaller(
    "server_action_updateSubmission",
    () => withTracePhase("server_action", () => checkUser())
  );

  if (!success || (user?.role !== "admin" && user?.role !== "assistant")) {
    return { success: false, message: "Unauthorized" };
  }

  await connectToDatabase();

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const submission = await Submission.findById(submissionId)
      .select("student exam")
      .session(session)
      .lean();
    if (!submission) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Submission not found" };
    }

    const exam = await Exam.findById(submission.exam)
      .select("gradeId")
      .session(session)
      .lean();

    if (user.role === "assistant") {
      const staffOk = await isStaff(user._id, String(exam?.gradeId || ""));
      if (!staffOk) {
        await session.abortTransaction();
        session.endSession();
        return { success: false, message: "Not authorized for this grade" };
      }
    }

    const submissionRes = await Submission.updateOne(
      { _id: submissionId },
      {
        $inc: {
          "score.correct": data.correct,
          "score.wrong": data.wrong,
        },
        $set: {
          isCompleted: true,
        },
        $push: {
          questionsAnswered: { $each: data.arrayOfQuestions },
        },
      },
      { session }
    );

    if (submissionRes.modifiedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        message: "Error updating submission, please try again",
      };
    }

    const essayRes = await Essay.updateOne(
      { submissionId },
      {
        $set: { isCompleted: true },
      },
      { session }
    );

    if (essayRes.modifiedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        message: "Error updating essay, please try again",
      };
    }

    await session.commitTransaction();
    session.endSession();

    try {
      await createNotification({
        userId: submission.student,
        type: "exam_result",
        title: "Your exam has been graded",
        body: "Your result has been published. You can review it now",
        link: "/userDashboard/exams",
      });
    } catch (_) {}

    return {
      success: true,
      message: "Submission and Essay updated successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    return { success: false, message: "Transaction failed, please try again" };
  }
}
