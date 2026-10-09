/**
 * parseYouTubeId — normalize any YouTube URL form (or raw ID) to the 11-char
 * videoId. Client+server safe (no DOM, no fetch). Returns null when no valid
 * id is found.
 *
 * Accepted inputs:
 *   - https://www.youtube.com/watch?v=VIDEOID
 *   - https://www.youtube.com/watch?v=VIDEOID&feature=shared&t=42
 *   - https://youtu.be/VIDEOID?si=...
 *   - https://www.youtube.com/embed/VIDEOID
 *   - https://www.youtube.com/shorts/VIDEOID
 *   - https://www.youtube.com/live/VIDEOID
 *   - http://m.youtube.com/watch?v=VIDEOID
 *   - bare "VIDEOID" (11 chars)
 *   - leading/trailing whitespace
 *
 * Does NOT accept playlist-only URLs (no v=) or channel URLs.
 */
export default function parseYouTubeId(input) {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (s === "") return null;

  // Bare 11-char id
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;

  // Strip protocol/host for easier matching
  let u;
  try {
    u = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host !== "youtube.com" && host !== "youtube-nocookie.com" && host !== "youtu.be") {
    return null;
  }

  // watch?v=VIDEOID
  const v = u.searchParams.get("v");
  if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

  // youtu.be/VIDEOID  /  /embed/VIDEOID  /  /shorts/VIDEOID  /  /live/VIDEOID
  const seg = u.pathname.split("/").filter(Boolean);
  const head = seg[0];
  if (head === "embed" || head === "shorts" || head === "live") {
    const id = seg[1];
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  }
  if (host === "youtu.be") {
    const id = seg[0];
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  }

  return null;
}