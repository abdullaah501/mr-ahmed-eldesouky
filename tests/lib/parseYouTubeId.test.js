import { describe, it, expect } from "vitest";
import parseYouTubeId from "../../lib/video/parseYouTubeId";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("parseYouTubeId", () => {
  it("parses watch URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(
      parseYouTubeId(`https://www.youtube.com/watch?v=${VIDEO_ID}&feature=shared&t=42`)
    ).toBe(VIDEO_ID);
    expect(parseYouTubeId(`http://m.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("parses youtu.be share URLs", () => {
    expect(parseYouTubeId(`https://youtu.be/${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(parseYouTubeId(`https://youtu.be/${VIDEO_ID}?si=abc123&t=10`)).toBe(VIDEO_ID);
  });

  it("parses embed URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/embed/${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(parseYouTubeId(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("parses shorts URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("parses live URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/live/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it("accepts a raw 11-char id", () => {
    expect(parseYouTubeId(VIDEO_ID)).toBe(VIDEO_ID);
  });

  it("trims surrounding whitespace", () => {
    expect(parseYouTubeId(`   ${VIDEO_ID}   `)).toBe(VIDEO_ID);
    expect(parseYouTubeId(`  https://youtu.be/${VIDEO_ID} `)).toBe(VIDEO_ID);
  });

  it("returns null for unsupported platforms", () => {
    expect(parseYouTubeId("https://vimeo.com/123456789")).toBeNull();
    expect(parseYouTubeId("https://example.com/watch?v=abcdefghijk")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("    ")).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId(undefined)).toBeNull();
    expect(parseYouTubeId(123)).toBeNull();
    expect(parseYouTubeId("https://youtube.com/watch")).toBeNull();
    expect(parseYouTubeId("https://youtube.com/watch?v=tooshort")).toBeNull();
    expect(parseYouTubeId("https://youtube.com/watch?v=thisidwaytoolong11")).toBeNull();
    expect(parseYouTubeId("https://youtu.be/")).toBeNull();
    expect(parseYouTubeId("not12chars")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/c/somechannel")).toBeNull();
  });
});