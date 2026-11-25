import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  THUMBNAIL_GUEST_INTERFACE,
  THUMBNAIL_IMPORT_FOOTPRINTS,
} from "./imports.js";
import type { GuestBindResult, GuestImportCheck, ThumbnailGuestRuntime } from "./runtime.js";

export type { GuestBindResult } from "./runtime.js";

export const GUEST_WIT_DIGEST =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

export const THUMBNAIL_GUEST_WASM = fileURLToPath(
  new URL("../../guests/thumbnail/thumbnail.component.wasm", import.meta.url),
);

export const THUMBNAIL_OVERREACH_WASM = fileURLToPath(
  new URL(
    "../../guests/thumbnail-overreach/overreach.component.wasm",
    import.meta.url,
  ),
);

export function formatUnmappedImportReport(
  check: Extract<GuestImportCheck, { status: "refused" }>,
): string {
  return `guest imports are not a subset of the host map; unmapped: ${check.unmapped.join(", ")}`;
}

/**
 * Bind a guest component under the thumbnail import map.
 *
 * Reads actual imports from the component binary. A guest that asks for
 * anything outside the host offer is refused before it runs.
 */
export async function bindThumbnailGuest(
  runtime: ThumbnailGuestRuntime,
  bytes: Uint8Array,
): Promise<GuestBindResult> {
  const realized = await runtime.inspect({
    bytes,
    interfaceName: THUMBNAIL_GUEST_INTERFACE,
    footprints: THUMBNAIL_IMPORT_FOOTPRINTS,
    witDigest: GUEST_WIT_DIGEST,
  });
  if (realized.check.status === "refused") {
    return Object.freeze({
      status: "unrealized",
      unmapped: realized.check.unmapped,
      offered: realized.check.offered,
      report: formatUnmappedImportReport(realized.check),
    });
  }
  return Object.freeze({
    status: "bound",
    realizationId: realized.realizationId,
    used: realized.check.used,
  });
}

export function loadThumbnailGuestBytes(): Uint8Array {
  return new Uint8Array(readFileSync(THUMBNAIL_GUEST_WASM));
}

export function loadThumbnailOverreachBytes(): Uint8Array {
  return new Uint8Array(readFileSync(THUMBNAIL_OVERREACH_WASM));
}
