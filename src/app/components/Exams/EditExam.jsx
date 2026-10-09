"use client";

import toast from "react-hot-toast";
import ExamGenerator from "./ExamGenerator/ExamGenerator";
import { ExamGeneratorController } from "./ExamGenerator/ExamGeneratorController";
import { getCapabilities } from "@/question-system/capabilities";

export default function EditExam({ exam, queryClient }) {
  // Grade-scoped exams: the context is fixed after creation.
  const context = {
    type: "grade",
    gradeId: exam?.gradeId ? String(exam.gradeId) : null,
    gradeName: exam?._gradeName || "",
  };

  async function handleCreate() {
    return { success: false, message: "Not supported in edit mode" };
  }

  async function handleUpdate({ examId, questions }) {
    return await ExamGeneratorController.update({ examId, questions });
  }

  function handleSuccess(result) {
    toast.success(result.message || "تم تحديث الاختبار بنجاح");
    queryClient.invalidateQueries(["examsByGrade"]);
  }

  return (
    <ExamGenerator
      capabilities={getCapabilities("lesson-edit")}
      context={context}
      contextValid={Boolean(context.gradeId)}
      initialQuestions={exam?.questions || []}
      initialTitle={exam?.title || ""}
      examId={exam?._id}
      persistence={{ create: handleCreate, update: handleUpdate }}
      onSuccess={handleSuccess}
    />
  );
}
