// videoProvider/createVideoProvider.js
//
// The ONLY place that knows the provider routing. LecturePlayer consumes the
// returned `{ init, refresh, destroy, render, facade }` interface without
// branching on provider type. External recordings are YouTube (IFrame API)
// or Zoom (closed embed rendered by LecturePlayer itself).

import { createYouTubeProvider } from "./youtubeProvider";

export function createVideoProvider(opts) {
  const { videoRef, ytContainerRef, callbacks, fileKey } = opts;
  return createYouTubeProvider({ fileKey, videoRef, ytContainerRef, callbacks });
}
