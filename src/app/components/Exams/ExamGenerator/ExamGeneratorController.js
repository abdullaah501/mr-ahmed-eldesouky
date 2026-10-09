import { addExam, updateExam } from "@/app/actions/examActions";

export async function createExam({ context, questions, title }) {
  if (!context || context.type !== "grade" || !context.gradeId) {
    throw new Error("You must select a grade to save the exam");
  }

  const payload = questions.map((q) => {
    const { id, ...rest } = q;
    return rest._id ? { _id: rest._id, ...rest } : rest;
  });

  const result = await addExam({ gradeId: context.gradeId, questions: payload, title });
  return result;
}

export async function updateExistingExam({ examId, questions }) {
  const payload = questions.map((q) => {
    const { id, ...rest } = q;
    return rest._id ? { _id: rest._id, ...rest } : rest;
  });

  const result = await updateExam({ examId, questions: payload });
  return result;
}

export const ExamGeneratorController = {
  create: createExam,
  update: updateExistingExam,
};
