import { projectInteractions } from "@foxworth/boundary";
import { RENDER_COMPILED_INTERACTIONS } from "./compiled.js";
import type { RenderInteractionExposure } from "./mount.js";

/** Compile a desired caller surface. Does not inspect Installation availability. */
export function projectRenderInteractions(expose: RenderInteractionExposure = { render: "direct" }) {
  const mode = expose.render ?? "direct";
  return projectInteractions(RENDER_COMPILED_INTERACTIONS, {
    render: {
      interaction: RENDER_COMPILED_INTERACTIONS.handles.render,
      modes: [mode],
    },
  });
}
