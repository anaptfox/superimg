//! @superimg/adapters — portable core for SuperImg framework packages (unpublished).
//! Poster / payload / Vite plugin / OCI providers.
//! Framework-specific APIs live in @superimg/next, @superimg/react-router, etc.
//! Does not define rendering semantics.

export {
  type MediaPoster,
  type SerializableMediaPayload,
  type MediaSkeletonOptions,
  type MediaSkeletonVariant,
  type MediaSize,
  type MediaStageOptions,
  assertSerializablePayload,
  payloadFromMediaIR,
  createMediaPoster,
  createSkeletonMarkup,
  createSkeletonPoster,
  createSkeletonPosterFromIR,
  mediaAspectRatio,
  mediaStageStyle,
  mediaStageStyleAttr,
  renderMediaStage,
  renderPosterMarkup,
  renderPosterStage,
  renderSkeletonStage,
  SUPERIMG_SKELETON_CSS,
} from "./poster.js";

export {
  superimg,
  superimgViteConfig,
  joinBasePath,
  SUPERIMG_CLIENT_IMPORTS,
  SUPERIMG_SERVER_ONLY_IMPORTS,
  SUPERIMG_APP_FORBIDDEN_IMPORTS,
  type SuperimgViteOptions,
} from "./vite.js";

export {
  planDeploy,
  materializeDeployPlan,
  type DeployPlan,
  type DeployArtifactFile,
  type PlanDeployOptions,
  type OciRuntimeManifest,
} from "./providers.js";

export * from "./media-project.js";
