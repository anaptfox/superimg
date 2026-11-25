//! Public value surface for bare `import … from "@foxworth/superimg"` inside templates.
//!
//! Names match the value exports of the `superimg` package root
//! (`packages/superimg/src/index.ts` plus `index.shared.ts`). Internal
//! template-runtime helpers are intentionally absent so a missing named
//! import fails the bundle instead of running as `undefined`.

export {
  define,
  video,
  image,
  svg,
  ogImage,
  collection,
  googleFont,
  compose,
  sequence,
  choose,
  together,
  time,
  rebaseCompositionSources,
  replaceOccurrence,
  diffCompositionSchedules,
  source,
  layoutTimeline,
  arrange,
  ArrangeError,
  preparedNarrationAudio,
  h,
  Frame,
  Stack,
  Text,
  Safe,
  Vector,
  vector,
  Code,
  Spacer,
  Fill,
  Image,
  Video,
  Plate,
  Html,
  svgDocument,
  svgDocumentIdentity,
  SvgArtwork,
  NativeSurface,
  svgPart,
} from "./template-runtime.js";

export {
  SuperImgError,
  isSuperImgError,
  TemplateRuntimeError,
  IOError,
  isMediaElement,
} from "@superimg/types";
export { visual, Instance, Scene, resolveSceneTree, collectSceneSnapshots } from "./template-runtime.js";
export { subjectSet } from "./template-runtime.js";
export type { SubjectDesign, SubjectEntity, SubjectSample, SubjectSet, SubjectBinding, SubjectValue } from "./template-runtime.js";
export type { VisualDefinition, VisualFrame, VisualPart, InstanceProps, SpatialSceneProps, SceneProjection, SpatialSceneSnapshot, SceneBounds, ScenePosition, SceneMatrix, MediaSemantic, SceneHitRegion } from "./template-runtime.js";
