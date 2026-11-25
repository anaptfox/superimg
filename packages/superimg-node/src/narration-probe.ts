import { inspectNativeMedia } from "./runtime/media.js";
import type { MediaInspection } from "@superimg/types";

/** Inspect an already-owned encoded artifact without fetching or publishing it. */
export async function inspectEncodedMedia(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<MediaInspection> {
  return inspectNativeMedia({ kind: "bytes", bytes }, globalThis.fetch, signal);
}
