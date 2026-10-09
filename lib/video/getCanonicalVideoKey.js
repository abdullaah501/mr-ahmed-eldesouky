import parseYouTubeId from "./parseYouTubeId";

export default function getCanonicalVideoKey(video) {
  if (!video) return null;
  if (typeof video === "string") return parseYouTubeId(video);
  if (video.provider === "youtube") return video.videoId;
  if (video.isEmbed) return video.url;
  return video.cloudId;
}
