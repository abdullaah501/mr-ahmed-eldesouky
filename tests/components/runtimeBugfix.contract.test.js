import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("runtime bugfix contracts", () => {
  it("Quiz imports useQuery from the project's react-query convention", () => {
    const quiz = read("src/app/components/Quiz.jsx");
    expect(quiz).toContain('import { useQuery } from "@tanstack/react-query"');
    expect(quiz).toContain("useQuery({");
  });

  it("LecturePlayer does not latch the fallback error on the provider's clear signal", () => {
    const player = read("src/app/components/LecturePlayer.jsx");
    // onError(null) from provider init()/refresh() must CLEAR the state,
    // not coerce into the fallback message (was: msg || "تعذر...").
    expect(player).toContain("setError(msg ?? null)");
    expect(player).not.toContain('setError(msg || "تعذر تشغيل التسجيل")');
  });

  it("genuine provider errors still surface the error UI", () => {
    const player = read("src/app/components/LecturePlayer.jsx");
    expect(player).toContain("{isYoutube && error &&");
    const provider = read(
      "src/app/components/video/videoProvider/youtubeProvider.js"
    );
    expect(provider).toContain("onError(msg)");
  });
});
