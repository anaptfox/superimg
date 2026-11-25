//! `--for` canvas for check and inspect. Export already plans destinations;
//! these commands evaluate one loaded value, so the canvas has to land on it.

import { resolveDestinationTarget } from "@superimg/core/destinations";
import type { DestinationTarget } from "@superimg/core/destinations";
import type { DeterministicMediaDefinition, JsonObject, MediaValue } from "@superimg/types";

export interface DestinationCanvas {
  readonly width: number;
  readonly height: number;
}

export function canvasFromDestinationTarget(target: DestinationTarget): DestinationCanvas {
  if (target.kind === "custom") return { width: target.width, height: target.height };
  return target.destination.recommendedCanvas.value;
}

function authoredCanvas(media: DeterministicMediaDefinition<JsonObject>): DestinationCanvas {
  const width = media.config?.width;
  const height = media.config?.height;
  return {
    width: typeof width === "number" && Number.isSafeInteger(width) && width > 0 ? width : 1920,
    height: typeof height === "number" && Number.isSafeInteger(height) && height > 0 ? height : 1080,
  };
}

function mediaOf(value: Exclude<MediaValue, { readonly kind: "interactive" }>): DeterministicMediaDefinition<JsonObject> {
  return (value.kind === "collection" ? value.media : value) as DeterministicMediaDefinition<JsonObject>;
}

function withCanvas<T extends Exclude<MediaValue, { readonly kind: "interactive" }>>(value: T, canvas: DestinationCanvas): T {
  if (value.kind === "collection") {
    return {
      ...value,
      media: {
        ...value.media,
        config: { ...value.media.config, width: canvas.width, height: canvas.height },
      },
    } as T;
  }
  return {
    ...value,
    config: { ...value.config, width: canvas.width, height: canvas.height },
  } as T;
}

/**
 * Apply one `--for` target to a loaded media value.
 * An exact edition size selects that edition. A square target with no matching
 * edition fails `MISSING_EDITION`. Any other size overrides the authored canvas
 * so responsive `ctx.width` / `ctx.height` templates see the destination.
 * `--edition` together with a different canvas is an error.
 */
export function applyDestinationTarget<T extends { readonly value: MediaValue }>(
  loaded: T,
  target: string | undefined,
  edition: string | undefined,
): { readonly loaded: T; readonly edition: string | undefined } {
  if (target === undefined || target.trim() === "") return { loaded, edition };
  const resolved = resolveDestinationTarget(target);
  const canvas = canvasFromDestinationTarget(resolved);
  const value = loaded.value;
  if (value.kind === "interactive") {
    throw Object.assign(new Error("--for does not apply to interactive media"), { code: "UNSUPPORTED_SELECTION" });
  }
  const media = mediaOf(value);
  const authored = authoredCanvas(media);
  if (edition !== undefined) {
    const named = edition === "default" ? undefined : media.editions?.[edition];
    if (edition !== "default" && named === undefined) {
      throw new Error(`Unknown media edition ${JSON.stringify(edition)}`);
    }
    const size = named?.size ?? authored;
    if (size.width !== canvas.width || size.height !== canvas.height) {
      throw Object.assign(
        new Error(`--edition ${JSON.stringify(edition)} is ${size.width}×${size.height} but --for ${JSON.stringify(target)} is ${canvas.width}×${canvas.height}`),
        { code: "EDITION_TARGET_MISMATCH" },
      );
    }
    return { loaded, edition };
  }
  if (canvas.width === authored.width && canvas.height === authored.height) return { loaded, edition };
  for (const [id, named] of Object.entries(media.editions ?? {})) {
    if (named.size.width === canvas.width && named.size.height === canvas.height) {
      return { loaded, edition: id };
    }
  }
  if (canvas.width === canvas.height && authored.width !== authored.height) {
    throw Object.assign(
      new Error(`Square destination ${canvas.width}×${canvas.height} needs an exact-aspect edition; authored canvas is ${authored.width}×${authored.height}. Add editions.square — do not letterbox landscape art.`),
      { code: "MISSING_EDITION" },
    );
  }
  return { loaded: { ...loaded, value: withCanvas(value, canvas) }, edition };
}
