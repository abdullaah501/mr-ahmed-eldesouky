import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) =>
  readFileSync(resolve(process.cwd(), p), "utf8");

describe("student grades query-key contract", () => {
  const exams = read("src/app/components/userDashboard/MyExamsSection.jsx");
  const grades = read("src/app/components/userDashboard/MyGradesSection.jsx");

  it("Exams tab no longer shares the ['myGrades'] key with the Grades tab", () => {
    expect(exams).toContain('queryKey: ["myGradesList"]');
    expect(exams).not.toContain('queryKey: ["myGrades"]');
    expect(grades).toContain('queryKey: ["myGrades"]');
  });

  it("Exams tab guards the grades payload as an array", () => {
    expect(exams).toContain("Array.isArray(res.data)");
  });

  it("both consumers still expect the documented getMyGrades response shape", () => {
    // getMyGrades(): { success, data: Grade[] } — the Grades tab reads the
    // full envelope (res), the Exams tab reads the array (res.data).
    expect(exams).toContain("getMyGrades");
    expect(grades).toContain("gradesQuery.data?.data");
  });
});

describe("admin bell removal contract", () => {
  it("NotificationBell is hidden for admins in the shared wrapper", () => {
    const wrapper = read("src/app/components/dataWrappers/ClientWrapper.jsx");
    expect(wrapper).toContain('user.role !== "admin"');
  });

  it("student bell component itself is untouched", () => {
    const bell = read("src/app/components/notifications/NotificationBell.jsx");
    expect(bell).toContain("FiBell");
  });
});

describe("automatic notifications remain intact", () => {
  it("lecture create/publish triggers stay fire-and-forget", () => {
    const actions = read("src/app/actions/lectureActions.js");
    const matches = actions.match(/void createNotificationsForGrade/g) || [];
    expect(matches.length).toBe(2);
  });

  it("exam create/update triggers stay fire-and-forget", () => {
    const actions = read("src/app/actions/examActions.js");
    const matches = actions.match(/void \(async \(\) => \{/g) || [];
    expect(matches.length).toBe(2);
  });

  it("new_lecture/new_exam remain absent from the manual composer", () => {
    const section = read(
      "src/app/components/notifications/NotificationsSection.jsx"
    );
    const typeBlock = section.slice(
      section.indexOf("TYPE_OPTIONS"),
      section.indexOf("];")
    );
    expect(typeBlock).not.toContain("new_lecture");
    expect(typeBlock).not.toContain("new_exam");
  });

  it("notification TTL remains configured on the model", () => {
    const model = read("models/Notification.js");
    expect(model).toContain("expires: notificationTtlDays()");
  });
});
