import { sequence } from "@foxworth/superimg";
import landscapeStill from "./parts/landscape-still.media.js";
import portraitStill from "./parts/portrait-still.media.js";
import squareVideo from "./parts/square-video.media.js";
import landscapeVideo from "./parts/landscape-video.media.js";

export const mixedMediaSize = { width: 1280, height: 720 } as const;
export const mixedMediaFps = 24;

export const mixedMedia = sequence([
  { id: "landscape-still", content: landscapeStill, hold: "1s" },
  { id: "portrait-still", content: portraitStill, hold: "1s", fit: "contain" },
  { id: "square-video", content: squareVideo, fit: "cover" },
  { id: "landscape-video", content: landscapeVideo },
]);
