"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import ExamGenerator from "@/app/components/Exams/ExamGenerator/ExamGenerator";
import { ExamGeneratorController } from "@/app/components/Exams/ExamGenerator/ExamGeneratorController";
import GradeContextAdapter from "@/app/components/Exams/ExamGenerator/contexts/GradeContextAdapter";
import { getCapabilities } from "@/question-system/capabilities";

export default function ExamNewClient({ role = "admin" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [context, setContext] = useState(null);
  const [contextValid, setContextValid] = useState(false);

  async function handleCreate({ context: ctx, questions, title }) {
    return await ExamGeneratorController.create({
      context: ctx,
      questions,
      title,
    });
  }

  function handleSuccess(result) {
    toast.success(result.message || "تمت إضافة الاختبار بنجاح");
    queryClient.invalidateQueries(["examsByGrade"]);
    router.push("/dashboard/exams");
  }

  return (
    <div>
      <ExamGenerator
        capabilities={getCapabilities("lesson-create")}
        context={context}
        contextValid={contextValid}
        persistence={{
          create: handleCreate,
          update: async () => ({ success: false }),
        }}
        onSuccess={handleSuccess}
        contextSlot={
          <GradeContextAdapter
            role={role}
            value={context?.gradeId || ""}
            onContextChange={(ctx, valid) => {
              setContext(ctx);
              setContextValid(valid);
            }}
          />
        }
      />
    </div>
  );
}
