import { resolveByIds } from "./QuestionResolver";
import { toClientQuestion } from "./toClientQuestion";

export async function hydrateExams(exams) {
  if (!exams?.length) return exams;

  const allQuestionIds = [];
  for (const exam of exams) {
    if (exam.questionItems?.length) {
      for (const item of exam.questionItems) {
        if (item.questionId) {
          allQuestionIds.push(item.questionId);
        }
      }
    }
  }

  let questionMap = new Map();
  if (allQuestionIds.length) {
    questionMap = await resolveByIds(allQuestionIds);
  }

  for (const exam of exams) {
    if (exam.questionItems?.length) {
      const ordered = [...exam.questionItems].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      exam.questions = ordered
        .map((item) => {
          const q = questionMap.get(String(item.questionId));
          return q ? toClientQuestion(q) : null;
        })
        .filter(Boolean);
    } else if (exam.questions?.length) {
      exam.questions = exam.questions.map(toClientQuestion);
    } else {
      exam.questions = [];
    }

    delete exam.questionItems;
  }

  return exams;
}
