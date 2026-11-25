import type { GuestCallResult, ThumbnailGuestRuntime } from "./runtime.js";
import {
  bindThumbnailGuest,
  GUEST_WIT_DIGEST,
  loadThumbnailGuestBytes,
  type GuestBindResult,
} from "./bind.js";
import { createThumbnailHostImports, type HostImportResult } from "./hosts.js";
import { THUMBNAIL_GUEST_INTERFACE, THUMBNAIL_IMPORT_FOOTPRINTS } from "./imports.js";
import { createMemoryRasterStore, type DecodedRaster, type MediaRasterStore } from "../rasters.js";

function adapt(result: HostImportResult) {
  if ("ok" in result) {
    return result.ok;
  }
  return { tag: "err" as const, val: result.err };
}

export async function executeThumbnailGuest(args: {
  runtime: ThumbnailGuestRuntime;
  bytes: Uint8Array;
  store: MediaRasterStore;
  input: { artifactId: string; maxWidth: number };
}): Promise<GuestCallResult | Extract<GuestBindResult, { status: "unrealized" }>> {
  const bound = await bindThumbnailGuest(args.runtime, args.bytes);
  if (bound.status !== "bound") {
    return bound;
  }
  const hosts = createThumbnailHostImports(args.store);
  return args.runtime.execute({
    bytes: args.bytes,
    interfaceName: THUMBNAIL_GUEST_INTERFACE,
    footprints: THUMBNAIL_IMPORT_FOOTPRINTS,
    witDigest: GUEST_WIT_DIGEST,
    host: {
      "media.artifacts": (request) => adapt(hosts["media.artifacts"](request)),
      "media.thumbnails": (request) => adapt(hosts["media.thumbnails"](request)),
    },
    exportName: "media-artifact-thumbnail",
    input: JSON.stringify(args.input),
  });
}

export function demoThumbnailSource(): {
  store: MediaRasterStore & { putArtifact(id: string, raster: DecodedRaster): void };
  artifactId: string;
} {
  const store = createMemoryRasterStore();
  const width = 800;
  const height = 600;
  store.putArtifact("original", {
    width,
    height,
    rgba: new Uint8Array(width * height * 4),
  });
  return { store, artifactId: "original" };
}

export async function executeCopiedThumbnailGuest(runtime: ThumbnailGuestRuntime): Promise<GuestCallResult | GuestBindResult> {
  const { store, artifactId } = demoThumbnailSource();
  return executeThumbnailGuest({
    runtime,
    bytes: loadThumbnailGuestBytes(),
    store,
    input: { artifactId, maxWidth: 200 },
  });
}
