import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("lecture video preview reuses the student player", () => {
  const form = read("src/app/components/lectures/LecturesSection.jsx");
  const studentPage = read("src/app/components/userDashboard/GradeDetail.jsx");

  it("there is exactly one LecturePlayer implementation", () => {
    const videoDir = resolve(
      process.cwd(),
      "src/app/components/video/videoProvider"
    );
    const names = readdirSync(videoDir);
    expect(names.filter((n) => /preview|admin/i.test(n))).toHaveLength(0);
    expect(existsSync(resolve(process.cwd(), "src/app/components/LecturePlayer.jsx"))).toBe(true);
  });

  it("the form renders the same LecturePlayer the student page uses", () => {
    expect(form).toContain('import LecturePlayer from "../LecturePlayer"');
    expect(studentPage).toContain('import LecturePlayer from "../LecturePlayer"');
  });

  it("preview normalizes with the same validation the save path uses", () => {
    expect(form).toContain("validateRecordingInput");
    const actions = read("src/app/actions/lectureActions.js");
    expect(actions).toContain("validateRecordingInput");
  });

  it("preview is driven by current form state without saving", () => {
    expect(form).toContain("useMemo");
    expect(form).not.toContain("createLecture({");
  });

  it("empty and invalid recordings show placeholders, never a broken player", () => {
    expect(form).toContain('state: "empty"');
    expect(form).toContain('state: "invalid"');
    expect(form).toContain("دخل رابط الفيديو عشان تشوف المعاينة");
  });

  it("preview only renders after validation succeeds", () => {
    const readyIdx = form.indexOf('state: "ready"');
    const renderIdx = form.indexOf('preview.state === "ready"');
    expect(readyIdx).toBeGreaterThan(-1);
    expect(renderIdx).toBeGreaterThan(-1);
  });
});

describe("lecture modal overflow", () => {
  const modal = read("src/app/components/modal/Modal.jsx");

  it("modal panel is viewport-height constrained", () => {
    expect(modal).toContain("max-h-[calc(100dvh-2rem)]");
    expect(modal).toContain("flex-col");
  });

  it("modal content is the internal scroll container", () => {
    expect(modal).toContain("flex-1 min-h-0 overflow-y-auto");
  });

  it("header stays fixed above the scrollable content", () => {
    expect(modal).toContain("shrink-0");
  });

  it("lecture player itself is untouched by the modal fix", () => {
    const player = read("src/app/components/LecturePlayer.jsx");
    expect(player).toContain('aspectRatio: "16 / 9"');
    expect(player).not.toContain("max-h-[calc");
  });
});
