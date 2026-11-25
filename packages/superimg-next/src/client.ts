//! @superimg/next/client — Client Component entry ("use client").
//! Import Player / island helpers only from this path in client files.

"use client";

export {
  Player,
  type PlayerProps,
  type PlayerRef,
  type PlayerInput,
  type LoadResult,
} from "@foxworth/superimg/react/player";

export type { SerializableMediaPayload, MediaPoster } from "@superimg/adapters";

export { posterHtmlFromPayload } from "./client-poster.js";
export {
  MediaPlayerIsland,
  type MediaPlayerIslandProps,
} from "./components/MediaPlayerIsland.js";
