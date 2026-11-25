//! Interactive authoring and pure projections. No DOM controller, Player or React.

export {
  defineInteractive,
  isInteractiveDefinition,
  assertInteractiveDefinition,
  lowerInteractiveDefinition,
  resolveInteractiveClock,
  resolveInteractiveSize,
  INTERACTIVE_DEFAULT_FPS,
  INTERACTIVE_DEFAULT_SIZE,
  type InteractiveClock,
  type InteractiveRuntimeTemplate,
  type LowerInteractiveOptions,
} from "./definition.js";

export {
  INTERACTIVE_EXTENSION_KEY,
  encodeInteractiveExtension,
  parseInteractiveExtension,
  isInteractiveExtension,
  attachInteractiveExtension,
  readInteractiveExtension,
  type InteractiveExtension,
  type InteractiveExtensionPayload,
  type DecodedInteractiveExtension,
} from "./extension.js";

// Interactive owns the semantic authoring/query and guide product surface.
export {
  createInteractiveSceneAuthoring,
  queryInteractiveScene,
  getInteractiveSceneNode,
  projectInteractiveSceneHtml,
} from "./semantic.js";

export {
  layoutInteractiveGuide,
  interactiveStepAtFrame,
  interactiveSceneAtFrame,
  parseInteractiveDuration,
} from "./guide-controller.js";

export {
  checkInteractiveScene,
  type InteractiveCheckIssue,
  type InteractiveCheckResult,
} from "./check.js";

export {
  scene,
  centeredCamera,
  focusOn,
  mergeNodePatch,
  captionStates,
  type SceneStd,
  type SceneNodePatch,
  type SceneTransformPatch,
  type SceneAnimationPatch,
  type CenteredCameraOpts,
  type CenteredCameraResult,
  type CaptionStateOpts,
} from "./scene-helpers.js";

export type {
  CanvasSize,
  DefineInteractiveInput,
  InteractiveDefinition,
  InteractiveRenderContext,
  SceneActionEvent,
  SceneAnimation,
  SceneAuthoring,
  SceneCameraAuthoring,
  SceneCameraPatch,
  SceneCameraSnapshot,
  SceneFadeInOptions,
  SceneGuide,
  SceneGuideStep,
  GuideCheckpoint,
  GuideLayout,
  SceneNodeBinding,
  SceneNodeDefinition,
  SceneNodeId,
  SceneNodeSnapshot,
  SceneNodeStatePatch,
  SceneOperation,
  ScenePulseOptions,
  SceneQuery,
  SceneRuntimeInput,
  SceneStateDefinition,
  SceneStateInput,
  SceneStyleRenderer,
  SceneStyleRendererInput,
  SceneTransform,
  SceneSnapshot,
} from "./contracts.js";
