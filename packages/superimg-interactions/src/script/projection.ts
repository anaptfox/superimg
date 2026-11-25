import { SCRIPT_COMPILED_INTERACTIONS } from "./compiled.js";
import type { ScriptInteractionExposure } from "./mount.js";
import { projectExposure } from "../project-exposure.js";

/** Compile a desired caller surface. Does not inspect Installation availability. */
export function projectScriptInteractions<const Exposure extends ScriptInteractionExposure>(expose: Exposure) {
  return projectExposure(SCRIPT_COMPILED_INTERACTIONS, expose);
}
