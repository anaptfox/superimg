//! Map machine edit capabilities to the three P0 user-facing states.

import type { EditCapability, EditUiState } from "@superimg/types";

/** Map each supported machine capability to its UI state. */
export function toEditUiState(capability: EditCapability): EditUiState {
  switch (capability) {
    case "exact":
      return "editable";
    case "opaque":
      return "opaque";
    case "inspect-only":
      return "inspect-only";
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

/** Map Media IR visual opacity labels into edit capability. */
export function visualCapabilityToEdit(
  visual: string | undefined | null,
): EditCapability | null {
  if (visual === "opaque-html" || visual === "opaque-svg") return "opaque";
  if (visual === "tree") return "inspect-only";
  return null;
}
