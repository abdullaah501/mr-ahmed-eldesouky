import "server-only";
import QuizDraft from "../../models/QuizDraft";
import Submission from "../../models/Submission";

function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.codeName === "DuplicateKeyError";
}

/** Minimal canonical draft (answers + revision) or null. */
export async function getDraft(studentId, examId) {
  return QuizDraft.findOne({ studentId, examId })
    .select("answers revision")
    .lean();
}

export async function deleteDraft(studentId, examId, session) {
  const filter = { studentId, examId };
  return session
    ? QuizDraft.deleteOne(filter, { session })
    : QuizDraft.deleteOne(filter);
}

export async function hasSubmission(studentId, examId) {
  return Submission.exists({ student: studentId, exam: examId });
}

/**
 * Canonical, revision-guarded save.
 *
 * client baseRevision === stored revision → accept, revision + 1.
 * anything else                          → no overwrite, return canonical.
 *
 * A late device can never revive a draft after submission: the submitted
 * guard runs before the write and is re-checked after it.
 */
export async function saveDraft({ studentId, examId, baseRevision, answers }) {
  if (await hasSubmission(studentId, examId)) {
    await deleteDraft(studentId, examId);
    return { status: "submitted" };
  }

  let saved = null;
  try {
    if (baseRevision === 0) {
      // First accepted sync: create revision 1 atomically. The unique
      // (studentId, examId) index turns a duplicate-create race into E11000.
      saved = await QuizDraft.findOneAndUpdate(
        { studentId, examId, revision: 0 },
        { $set: { answers }, $inc: { revision: 1 } },
        { upsert: true, new: true }
      ).lean();
    } else {
      saved = await QuizDraft.findOneAndUpdate(
        { studentId, examId, revision: baseRevision },
        { $set: { answers }, $inc: { revision: 1 } },
        { new: true }
      ).lean();
    }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // Lost the duplicate-create race — canonical state is authoritative.
    const draft = await getDraft(studentId, examId);
    return { status: "conflict", draft: draft || null };
  }

  if (!saved) {
    // The draft changed or disappeared between read and write (for example
    // the submission transaction deleted it).
    if (await hasSubmission(studentId, examId)) {
      await deleteDraft(studentId, examId);
      return { status: "submitted" };
    }
    const draft = await getDraft(studentId, examId);
    return { status: "conflict", draft: draft || null };
  }

  // Close the check/write window: a submission that committed while this
  // write was in flight must not leave a draft behind.
  if (await hasSubmission(studentId, examId)) {
    await deleteDraft(studentId, examId);
    return { status: "submitted" };
  }

  return { status: "saved", revision: saved.revision };
}
