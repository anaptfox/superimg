import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import type { MediaInteractionExposure } from "./mount.js";
import { projectExposure } from "./project-exposure.js";

/** Compile a desired caller surface. Does not inspect Installation availability. */
export function projectMediaInteractions<const Exposure extends MediaInteractionExposure>(expose: Exposure) {
  return projectExposure(MEDIA_COMPILED_INTERACTIONS, expose);
}
