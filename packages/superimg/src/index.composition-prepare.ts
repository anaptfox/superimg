//! Per-job preparation of a retained Program for a host projection.
//!
//! This is an optional entry. The root authoring import stays synchronous and
//! small; preparation may resolve child data and assets asynchronously.

export { prepareComposition as prepareProgram } from "@superimg/core/player-composition";
export type {
  CompositionAssetProvider,
  CompositionAssetRequest,
  PreparedCompositionAsset,
  PrepareCompositionOptions as PrepareProgramOptions,
  PreparedComposition as PreparedProgram,
} from "@superimg/core/player-composition";
