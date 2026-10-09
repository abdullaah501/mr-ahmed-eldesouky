import { describe, it, expect } from "vitest";
import { validateRecordingInput } from "../../lib/video/recording";

describe("validateRecordingInput — server-side recording URL security", () => {
  it("returns ok:null when no provider given (lecture without recording)", () => {
    expect(validateRecordingInput({})).toEqual({ ok: true, recording: null });
    expect(validateRecordingInput({ provider: null, url: "x" })).toEqual({
      ok: true,
      recording: null,
    });
  });

  it("rejects unsupported providers", () => {
    const res = validateRecordingInput({ provider: "vimeo", url: "https://vimeo.com/1" });
    expect(res.ok).toBe(false);
  });

  it("rejects missing / empty / oversized urls", () => {
    expect(validateRecordingInput({ provider: "youtube" }).ok).toBe(false);
    expect(validateRecordingInput({ provider: "youtube", url: "   " }).ok).toBe(false);
    expect(
      validateRecordingInput({ provider: "youtube", url: "https://a.com/" + "x".repeat(3000) }).ok
    ).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://x.com/a"])(
    "rejects dangerous protocol %s",
    (url) => {
      const res = validateRecordingInput({ provider: "zoom", url });
      expect(res.ok).toBe(false);
    }
  );

  it("rejects http: (https only)", () => {
    expect(validateRecordingInput({ provider: "youtube", url: "http://youtu.be/abcdefghijk" }).ok).toBe(false);
  });

  it("normalizes every YouTube URL form to the 11-char videoId", () => {
    const forms = [
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://youtu.be/abcdefghijk?si=x",
      "https://www.youtube.com/embed/abcdefghijk",
      "https://www.youtube.com/shorts/abcdefghijk",
      "https://www.youtube.com/live/abcdefghijk",
      "abcdefghijk",
    ];
    for (const f of forms) {
      const res = validateRecordingInput({ provider: "youtube", url: f });
      expect(res.ok).toBe(true);
      expect(res.recording.youtubeVideoId).toBe("abcdefghijk");
      expect(res.recording.provider).toBe("youtube");
      expect(res.recording.originalUrl).toBeTruthy();
    }
  });

  it("rejects non-YouTube hosts on the youtube branch", () => {
    expect(
      validateRecordingInput({ provider: "youtube", url: "https://evil.com/watch?v=abcdefghijk" }).ok
    ).toBe(false);
  });

  it("accepts zoom.us recording URLs into embedUrl", () => {
    const res = validateRecordingInput({
      provider: "zoom",
      url: "https://us02web.zoom.us/rec/share/abc-123",
    });
    expect(res.ok).toBe(true);
    expect(res.recording.embedUrl).toContain("zoom.us/rec/share/abc-123");
    expect(res.recording.youtubeVideoId).toBeNull();
  });

  it("rejects non-zoom hosts on the zoom branch", () => {
    expect(
      validateRecordingInput({ provider: "zoom", url: "https://evil.zoom.us.evil.com/rec/x" }).ok
    ).toBe(false);
    expect(
      validateRecordingInput({ provider: "zoom", url: "https://example.com/rec/x" }).ok
    ).toBe(false);
  });
});
