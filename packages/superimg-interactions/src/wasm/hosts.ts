import {
  bytesToBase64,
  createThumbnail,
} from "@superimg/node/thumbnail";
import type { MediaRasterStore } from "../rasters.js";

export type HostImportResult =
  | Readonly<{ ok: string }>
  | Readonly<{ err: string }>;

function jsonOk(value: unknown): HostImportResult {
  return { ok: JSON.stringify(value) };
}

function jsonErr(message: string): HostImportResult {
  return { err: JSON.stringify({ error: message }) };
}

function readObject(request: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(request) as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Host functions backing the thumbnail import map.
 *
 * `media.artifacts` returns decoded dimensions (pixels stay host-side unless
 * a later guest asks for them). `media.thumbnails` scales, encodes, and stores.
 */
export function createThumbnailHostImports(store: MediaRasterStore): Readonly<{
  "media.artifacts"(request: string): HostImportResult;
  "media.thumbnails"(request: string): HostImportResult;
}> {
  return Object.freeze({
    "media.artifacts"(request) {
      const body = readObject(request);
      const artifactId = body?.artifactId;
      if (typeof artifactId !== "string" || artifactId.length === 0) {
        return jsonErr("artifactId is required");
      }
      const raster = store.readArtifact(artifactId);
      if (raster === undefined) {
        return jsonErr(`unknown artifact id: ${artifactId}`);
      }
      return jsonOk({ width: raster.width, height: raster.height });
    },
    "media.thumbnails"(request) {
      const body = readObject(request);
      const artifactId = body?.artifactId;
      const width = body?.width;
      const height = body?.height;
      if (typeof artifactId !== "string" || artifactId.length === 0) {
        return jsonErr("artifactId is required");
      }
      if (typeof width !== "number" || typeof height !== "number") {
        return jsonErr("width and height are required");
      }
      const source = store.readArtifact(artifactId);
      if (source === undefined) {
        return jsonErr(`unknown artifact id: ${artifactId}`);
      }
      const { raster: scaled, bytes } = createThumbnail(source, width);
      store.writeThumbnail(artifactId, scaled, bytes);
      return jsonOk({
        bytes: bytesToBase64(bytes),
        width: scaled.width,
        height: scaled.height,
      });
    },
  });
}
