//! RSC stub for @superimg/next/client — prevents Server Components from
//! pulling Player / WASM. Import Player from @superimg/next/client in a
//! "use client" module instead.

function fail(name: string): never {
  throw new Error(
    `@superimg/next/client: "${name}" is client-only. Mark the file with "use client", or import payload/poster helpers from @superimg/next/server.`,
  );
}

export function Player(): never {
  return fail("Player");
}

export function MediaPlayerIsland(): never {
  return fail("MediaPlayerIsland");
}

export function posterHtmlFromPayload(): never {
  return fail("posterHtmlFromPayload");
}

export type {
  PlayerProps,
  PlayerRef,
  PlayerInput,
  LoadResult,
} from "@foxworth/superimg/react/player";
export type { SerializableMediaPayload, MediaPoster } from "@superimg/adapters";
export type { MediaPlayerIslandProps } from "./components/MediaPlayerIsland.js";
