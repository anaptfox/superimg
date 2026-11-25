import { EDIT_COMPILED_INTERACTIONS } from "./compiled.js";
import type { EditInteractionExposure } from "./mount.js";
import { projectExposure } from "../project-exposure.js";

/** Compile a desired caller surface. Does not inspect Installation availability. */
export function projectEditInteractions<const Exposure extends EditInteractionExposure>(expose: Exposure) {
  return projectExposure(EDIT_COMPILED_INTERACTIONS, expose);
}
