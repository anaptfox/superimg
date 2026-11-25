//! CLI uses the same native compiler as other trusted Node hosts.
import { compileNodeEditableSource } from "@foxworth/superimg-node/edit";
import { createNodeEditInteractionMount, type EditInteractionMount } from "@foxworth/superimg-interactions";
export const compileCliEditableSource = compileNodeEditableSource;
export function createCliEditInteractionMount(projectRoot: string): EditInteractionMount<Record<string, never>> {
  return createNodeEditInteractionMount({ projectRoot, compileSource: args => compileNodeEditableSource(projectRoot, args) });
}
