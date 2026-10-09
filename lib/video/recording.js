import parseYouTubeId from "./parseYouTubeId";

// Server-side recording validation for Lecture.recording.
// https-only + host allowlist. Client-side validation is cosmetic only.
const ZOOM_HOST_SUFFIX = "zoom.us";

/**
 * Validate + normalize a lecture recording payload.
 * @param {Object} input - { provider, url } (url = raw teacher-provided link)
 * @returns {{ ok: true, recording: Object } | { ok: false, message: string }}
 */
export function validateRecordingInput({ provider, url }) {
  if (!provider) return { ok: true, recording: null };

  if (provider !== "youtube" && provider !== "zoom") {
    return { ok: false, message: "Unsupported recording provider" };
  }

  if (typeof url !== "string" || url.trim() === "") {
    return { ok: false, message: "Recording link is missing" };
  }
  const rawUrl = url.trim();
  if (rawUrl.length > 2000) {
    return { ok: false, message: "Recording link is too long" };
  }

  // YouTube branch: accept any form parseYouTubeId understands, including a
  // bare 11-char videoId. Everything else falls through to strict https+host
  // validation so javascript:/data:/file:/http: can never slip through.
  if (provider === "youtube") {
    const directId = parseYouTubeId(rawUrl);
    if (!directId) {
      return { ok: false, message: "Failed to extract the YouTube video id" };
    }
    let originalUrl = rawUrl;
    if (/^[A-Za-z0-9_-]{11}$/.test(rawUrl)) {
      originalUrl = `https://youtu.be/${directId}`;
    } else {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "https:") {
          return { ok: false, message: "Only https links are supported" };
        }
      } catch {
        return { ok: false, message: "Invalid recording link" };
      }
    }
    return {
      ok: true,
      recording: {
        provider,
        youtubeVideoId: directId,
        embedUrl: null,
        originalUrl,
        title: null,
      },
    };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, message: "Invalid recording link" };
  }

  // Kills javascript:, data:, file:, http: etc. by construction.
  if (parsed.protocol !== "https:") {
    return { ok: false, message: "Only https links are supported" };
  }

  // zoom
  const host = parsed.hostname.toLowerCase();
  if (!(host === ZOOM_HOST_SUFFIX || host.endsWith(`.${ZOOM_HOST_SUFFIX}`))) {
    return { ok: false, message: "Zoom meeting link is invalid or expired" };
  }
  return {
    ok: true,
    recording: {
      provider,
      youtubeVideoId: null,
      embedUrl: parsed.toString(),
      originalUrl: rawUrl,
      title: null,
    },
  };
}
