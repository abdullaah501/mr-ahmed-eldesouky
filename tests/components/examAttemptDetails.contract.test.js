import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

function block(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(endMarker, start);
  return source.slice(start, end === -1 ? undefined : end);
}

const modal = read("src/app/components/analytics/ExamAttemptDetailsModal.jsx");
const table = read("src/app/components/analytics/ExamResultsTable.jsx");
const studentDetails = read("src/app/components/analytics/StudentDetails.jsx");
const usersExamsResults = read(
  "src/app/components/analytics/UsersExamsResults.jsx"
);
const parentDashboard = read("src/app/components/guardian/ParentDashboard.jsx");

describe("ExamAttemptDetailsModal — query keys", () => {
  const keyBlock = block(modal, "queryKey: isAdmin", "queryFn:");

  it("uses the locked admin key", () => {
    expect(keyBlock).toContain(
      '["exam-attempt", "admin", String(studentId), String(examId)]'
    );
  });

  it("uses the locked guardian discriminant key", () => {
    expect(keyBlock).toContain("`guardian:${String(guardianToken).slice(-8)}`");
    expect(keyBlock).toContain("String(examId)");
  });

  it("never places the full guardian token in the key", () => {
    expect(keyBlock.match(/guardianToken/g)).toHaveLength(1);
    expect(keyBlock).not.toContain("String(guardianToken)]");
  });
});

describe("ExamAttemptDetailsModal — fetch behavior", () => {
  const adminBlock = block(
    modal,
    "async function fetchAdminAttempt",
    "async function fetchGuardianAttempt"
  );
  const guardianBlock = block(
    modal,
    "async function fetchGuardianAttempt",
    "export default function"
  );

  it("admin starts Submission and Exam concurrently via Promise.allSettled", () => {
    expect(adminBlock).toContain("Promise.allSettled");
    expect(adminBlock.indexOf("Promise.allSettled")).toBeLessThan(
      adminBlock.indexOf("/api/getSubmission")
    );
    expect(adminBlock).toContain("/api/getSubmission");
    expect(adminBlock).toContain("getExam(encodeExamId(examId))");
  });

  it("admin treats a 404 submission as not-found and a missing exam as fallback", () => {
    expect(adminBlock).toContain("response?.status !== 404");
    expect(adminBlock).toContain('"Exam not found"');
    expect(adminBlock).toContain("notFound: true");
  });

  it("guardian uses exactly one request with the token only in the header", () => {
    expect(guardianBlock).toContain('"/api/guardian/attempt"');
    expect(guardianBlock).toContain('"x-guardian-token": guardianToken');
    expect(guardianBlock).toContain("params: { examId }");
    expect(guardianBlock.match(/api\.get\(/g)).toHaveLength(1);
  });

  it("guardian never sends studentId", () => {
    expect(guardianBlock).not.toContain("studentId");
  });

  it("makes no per-question requests (only the two attempt fetches exist)", () => {
    expect(modal.match(/api\.get\(/g)).toHaveLength(2);
    const questionsBlock = block(
      modal,
      "questions.map((question, index)",
      "Unsupported question type"
    );
    expect(questionsBlock).not.toContain("api.get");
  });
});

describe("ExamAttemptDetailsModal — renderer reuse", () => {
  it("registers all six plugin renderers", () => {
    for (const type of [
      "multiple-choice",
      "true-false",
      "essay",
      "fill-blank",
      "matching",
      "image-choice",
    ]) {
      expect(modal).toContain(`@/question-system/plugins/${type}/index`);
    }
  });

  it("uses the registry instead of type switches", () => {
    expect(modal).toContain("get(question.type)");
    expect(modal).toContain("plugin?.Renderer");
    expect(modal).not.toMatch(/switch\s*\(/);
  });

  it("mirrors the Quiz review contract and uses stored correctness", () => {
    expect(modal).toContain(
      "question={{ ...question, isCorrect: answered?.isCorrect }}"
    );
    expect(modal).toContain("register={null}");
    expect(modal).toContain("isSubmitted={true}");
    expect(modal).toContain("userAnswer={answered?.answer}");
    expect(modal).toContain('mode="review"');
    expect(modal).toContain(
      "String(entry?.questionId) === String(question?._id)"
    );
    expect(modal).toContain("questionsAnswered");
  });

  it("does not re-grade inside the modal", () => {
    expect(modal).not.toContain("toLowerCase");
    expect(modal).not.toContain("correctAnswer?.trim");
  });
});

describe("ExamAttemptDetailsModal — states and cache", () => {
  it("implements loading/not-found/error/retry/fallback/empty states", () => {
    expect(modal).toContain('Spinner text="جاري تحميل تفاصيل المحاولة..."');
    expect(modal).toContain("notFound");
    expect(modal).toContain("إعادة المحاولة");
    expect(modal).toContain("query.refetch()");
    expect(modal).toContain("بيانات المحاولة ناقصة");
    expect(modal).toContain("مفيش أسئلة متاحة للامتحان ده");
    expect(modal).toContain("مبقاش متاح");
    expect(modal).toContain("مفيش إجابات مسجلة للمحاولة دي");
    expect(modal).toContain("نوع سؤال غير مدعوم");
  });

  it("uses the locked React Query options with safe percentage handling", () => {
    expect(modal).toContain("staleTime: 30_000");
    expect(modal).toContain("gcTime: 5 * 60_000");
    expect(modal).toContain("refetchOnWindowFocus: false");
    expect(modal).toContain("refetchOnReconnect: false");
    expect(modal).toContain("status >= 400 && status < 500");
    expect(modal).toContain(
      "total > 0 ? Math.round((correct / total) * 100) : 0"
    );
  });
});

describe("ExamResultsTable — opt-in click contract", () => {
  it("gates handlers and affordances on the callback", () => {
    expect(table).toContain("onExamResultClick");
    expect(table).toContain(
      "const clickable = typeof onExamResultClick === \"function\";"
    );
    expect(table.match(/role=\{clickable \? "button" : undefined\}/g)).toHaveLength(2);
    expect(table.match(/tabIndex=\{clickable \? 0 : undefined\}/g)).toHaveLength(2);
    expect(table.match(/cursor-pointer/g)).toHaveLength(2);
  });
});

describe("Admin consumers — modal wiring", () => {
  it("StudentDetails opens the modal with studentId + examId + meta", () => {
    expect(studentDetails).toContain("ExamAttemptDetailsModal");
    expect(studentDetails).toContain("onExamResultClick={handleExamResultClick}");
    expect(studentDetails).toContain('viewer="admin"');
    expect(studentDetails).toContain("examId={activeAttempt?.examId}");
    expect(studentDetails).toContain("if (!result?.examId) return;");
    expect(studentDetails).toContain("studentEmail: student?.email");
  });

  it("UsersExamsResults opens the modal without touching its cells", () => {
    expect(usersExamsResults).toContain("ExamAttemptDetailsModal");
    expect(usersExamsResults).toContain("openAttempt");
    expect(usersExamsResults).toContain('viewer="admin"');
    expect(usersExamsResults).toContain("onClick={isAttemptClickable(r) ? () => openAttempt(r) : undefined}");
    expect(usersExamsResults).toContain('{r.courseId?.title || "—"}');
    expect(usersExamsResults).toContain('{r.lessonId?.title || "—"}');
  });
});

describe("Guardian consumer — modal wiring", () => {
  it("ParentDashboard opens the guardian modal with the token and no studentId", () => {
    expect(parentDashboard).toContain("ExamAttemptDetailsModal");
    expect(parentDashboard).toContain("onExamResultClick={handleExamResultClick}");
    expect(parentDashboard).toContain('viewer="guardian"');
    expect(parentDashboard).toContain("guardianToken={guardianToken}");
    expect(parentDashboard).toContain("examId={activeAttempt?.examId}");
    expect(parentDashboard).toContain("if (!result?.examId) return;");

    const guardianModalBlock = block(
      parentDashboard,
      "<ExamAttemptDetailsModal",
      "</ExamAttemptDetailsModal>"
    );
    expect(guardianModalBlock).not.toContain("studentId");
  });

  it("guardian meta never includes the student email", () => {
    const handlerBlock = block(
      parentDashboard,
      "const handleExamResultClick",
      "const totalExams"
    );
    expect(handlerBlock).not.toContain("studentEmail");
  });
});

describe("fill-blank review DOM nesting", () => {
  const fillBlank = read("src/question-system/plugins/fill-blank/Renderer.jsx");

  it("review mode does not wrap MathRenderer in a <p> container", () => {
    const reviewBlock = block(
      fillBlank,
      'if (mode === "review")',
      "LEGACY FALLBACK"
    );
    expect(reviewBlock).toContain("MathRenderer");
    expect(reviewBlock).not.toMatch(/<p[ >]/);
  });

  it("answer mode does not wrap MathRenderer in a <p> container", () => {
    const answerBlock = block(
      fillBlank,
      "ANSWER MODE",
      "{/* Token pool */}"
    );
    expect(answerBlock).toContain("MathRenderer");
    expect(answerBlock).not.toMatch(/<p[ >]/);
  });
});
