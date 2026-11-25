//! Retained-composition preparation for the browser Player.
//!
//! This stays outside player-core so the common createDomPlayer path does not
//! carry composition planning, resource preparation, and frame projection.

export { prepareComposition } from "./composition/prepare.js";
export type {
  CompositionAssetProvider,
  CompositionAssetRequest,
  PreparedCompositionAsset,
  PrepareCompositionOptions,
  PreparedComposition,
} from "./composition/prepare.js";
export { time } from "./composition/time.js";
export { interactiveCompositionRuntimes } from "./composition/time.js";
