import type { DecodedRaster } from "@superimg/node/thumbnail";
export type { DecodedRaster } from "@superimg/node/thumbnail";
export { scaleRaster, encodeRasterBytes, bytesToBase64, base64ToBytes } from "@superimg/node/thumbnail";

export interface MediaRasterStore {
  readArtifact(artifactId: string): DecodedRaster | undefined;
  writeThumbnail(artifactId: string, raster: DecodedRaster, bytes: Uint8Array): void;
  readThumbnail(artifactId: string): Uint8Array | undefined;
}

export function createMemoryRasterStore(): MediaRasterStore & {
  putArtifact(artifactId: string, raster: DecodedRaster): void;
} {
  const artifacts = new Map<string, DecodedRaster>();
  const thumbnails = new Map<string, Uint8Array>();
  return {
    putArtifact(artifactId, raster) {
      artifacts.set(artifactId, raster);
    },
    readArtifact(artifactId) {
      return artifacts.get(artifactId);
    },
    writeThumbnail(artifactId, _raster, bytes) {
      thumbnails.set(artifactId, bytes);
    },
    readThumbnail(artifactId) {
      return thumbnails.get(artifactId);
    },
  };
}
