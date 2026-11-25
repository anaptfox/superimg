import {
  bytesToBase64,
  createThumbnail,
} from "@superimg/node/thumbnail";
import type { MediaRasterStore } from "../rasters.js";
import {
  MediaInteractionError,
  type MediaArtifactThumbnail,
  type MediaArtifactThumbnailInteractionInput,
  type MediaInteractionHandlerArgs,
} from "../contracts.js";

export function createNodeThumbnailHandler<Context>(store: MediaRasterStore) {
  return function thumbnail({
    input,
  }: MediaInteractionHandlerArgs<MediaArtifactThumbnailInteractionInput, Context>): MediaArtifactThumbnail {
    const source = store.readArtifact(input.artifactId);
    if (source === undefined) {
      throw new MediaInteractionError(
        "INVALID_INPUT",
        "media.artifact.thumbnail.input.artifactId",
        `unknown artifact: ${input.artifactId}`,
      );
    }
    const { raster: scaled, bytes } = createThumbnail(source, input.maxWidth);
    store.writeThumbnail(input.artifactId, scaled, bytes);
    return Object.freeze({
      bytes: bytesToBase64(bytes),
      width: scaled.width,
      height: scaled.height,
    });
  };
}
