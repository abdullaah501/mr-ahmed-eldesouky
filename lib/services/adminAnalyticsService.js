import "server-only";
import User from "../../models/User";
import Grade from "../../models/Grade";
import Lecture from "../../models/Lecture";
import Exam from "../../models/Exam";
import Submission from "../../models/Submission";

/** Single source of truth for admin overview counts (API route + RSC). */
export async function getAdminAnalyticsData() {
  const [gradesCount, lecturesCount, examsCount, submissionsCount, usersCount] =
    await Promise.all([
      Grade.estimatedDocumentCount(),
      Lecture.estimatedDocumentCount(),
      Exam.estimatedDocumentCount(),
      Submission.estimatedDocumentCount(),
      User.estimatedDocumentCount(),
    ]);

  return [
    { id: 1, title: "Joined Users", count: usersCount },
    { id: 2, title: "Grades", count: gradesCount },
    { id: 3, title: "Lectures", count: lecturesCount },
    { id: 4, title: "Exams", count: examsCount },
    { id: 5, title: "Recorded Answers", count: submissionsCount },
  ];
}
