import checkUser from "../../../../../lib/checkUser";
import { getExam } from "@/app/actions/examActions";
import { redirect } from "next/navigation";
import { withCaller, withTracePhase } from "../../../../../lib/trace/index.js";
import ExamClient from "./ExamClient";
import { FiAlertCircle } from "react-icons/fi";
import GoBackBtn from "@/app/components/GoBackBtn";

export default async function ExamPage({ params }) {
  return withCaller("platform_exam_page", () =>
    withTracePhase("rsc_render_page", async () => {
      const { success: authOk, user } = await checkUser();

      if (!user) redirect("/login");

      const { examId } = await params;

      const result = await getExam(examId);

      if (!result?.success || !result?.exam) {
        return (
          <div
            className="min-h-[70vh] flex items-center justify-center p-6"
          >
            <div className="text-center bg-background border border-foreground/10 p-8 sm:p-10 rounded-2xl shadow-sm max-w-md w-full space-y-4">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <FiAlertCircle size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  الاختبار غير متاح
                </h2>
                <p className="text-sm text-foreground/50">
                  {result?.message ||
                    "ربما تم حذفه أو ليس لديك صلاحية الوصول إليه"}
                </p>
              </div>
              <div className="pt-2">
                <GoBackBtn title="العودة" />
              </div>
            </div>
          </div>
        );
      }

      return (
        <ExamClient
          exam={result.exam}
          context={result.context}
          userId={JSON.stringify(user?._id)}
          draft={result.draft || null}
        />
      );
    }),
  );
}
