//! Serializable contracts for SuperImg's semantic scene sidecar.
//!
//! The scene graph describes meaning; HTML remains the visual source of truth.
//! These contracts intentionally contain no DOM types so a snapshot can move
//! unchanged between the compiler, browser player, exporters, and edge runtimes.

import type {
  CanvasSize,
  JsonObject,
  JsonValue,
  MediaCapabilities,
  MediaElement,
  RenderOutput,
  RenderContext,
  InteractiveCompositionRuntime,
} from "@superimg/types";

export type { CanvasSize };

import type { SceneNodeId, SceneTransform, SceneAnimation, SceneNodeStatePatch, SceneNodeDefinition, SceneFadeInOptions, ScenePulseOptions, SceneOperation, SceneCameraPatch, SceneCameraSnapshot, SceneStateDefinition, SceneStateInput, SceneNodeSnapshot, SceneSnapshot, SceneQuery, SceneSnapshotOptions, SceneRuntimeInput, SceneStyleRendererInput, SceneStyleRenderer, SceneNodeBinding, SceneCameraAuthoring, SceneAuthoring, SceneSemanticValue } from "@superimg/types";
export type { SceneNodeId, SceneTransform, SceneAnimation, SceneNodeStatePatch, SceneNodeDefinition, SceneFadeInOptions, ScenePulseOptions, SceneOperation, SceneCameraPatch, SceneCameraSnapshot, SceneStateDefinition, SceneStateInput, SceneNodeSnapshot, SceneSnapshot, SceneQuery, SceneSnapshotOptions, SceneRuntimeInput, SceneStyleRendererInput, SceneStyleRenderer, SceneNodeBinding, SceneCameraAuthoring, SceneAuthoring, SceneSemanticValue } from "@superimg/types";

/** Ordered explainer journey owned by the interactive package. */
export interface SceneGuide {
  readonly id: string;
  readonly steps: readonly SceneGuideStep[];
}

export interface SceneGuideStep {
  readonly id: string;
  readonly label: string;
  readonly note?: string;
  readonly scene: SceneRuntimeInput;
  readonly duration: string;
  readonly focusNodeId?: string;
}

/** Derived timeline address of one guide step (half-open frame range). */
export interface GuideCheckpoint {
  readonly stepId: string;
  readonly label: string;
  readonly note?: string;
  readonly scene: SceneRuntimeInput;
  readonly focusNodeId?: string;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly startSeconds: number;
  readonly durationSeconds: number;
}

export interface GuideLayout {
  readonly guideId: string;
  readonly totalSeconds: number;
  readonly totalFrames: number;
  readonly fps: number;
  readonly checkpoints: readonly GuideCheckpoint[];
}

/** Interactive-owned IR payload shape used inside the schema-0 extension. */
export interface MediaIRGuide {
  readonly id: string;
  readonly steps: readonly MediaIRGuideStep[];
}

export interface MediaIRGuideStep {
  readonly id: string;
  readonly label: string;
  readonly note?: string;
  readonly range: { startFrame: number; endFrame: number };
  readonly scene: SceneRuntimeInput;
  readonly focusNodeId?: string | null;
}

export interface SceneActionEvent {
  readonly action: string;
  readonly nodeId: string;
  readonly frame: number;
  /** Identity of the accepted mounted render that declared this action. */
  readonly presentation: {
    readonly generation: number;
    readonly revision: number;
    readonly frame: number;
    readonly sceneId: string;
  };
}

export type InteractiveRenderContext<TData = JsonObject> = RenderContext<TData> & {
  scene: SceneAuthoring;
};

/** One singular live interactive experience. */
export interface InteractiveDefinition<TData = JsonObject> {
  readonly kind: "interactive";
  /** Compiler or host metadata carried unchanged into the media runtime. */
  readonly mediaCapabilities?: MediaCapabilities;
  /** Composition-owned live projection factory; the guide remains deterministic for offline export. */
  createCompositionRuntime(): InteractiveCompositionRuntime;
  guide: SceneGuide;
  /**
   * Authored canvas. Offline export + discovery use this size.
   * When omitted, hosts fall back to 1920×1080 (`INTERACTIVE_DEFAULT_SIZE`).
   * Layout-sensitive templates should always set this explicitly.
   */
  size?: CanvasSize;
  sample?: TData;
  render: (ctx: InteractiveRenderContext<TData>) => RenderOutput;
}

export interface DefineInteractiveInput<TData = JsonObject> {
  guide: SceneGuide;
  /**
   * Authored canvas for offline export and discovery inventory.
   * Defaults to 1920×1080 when omitted — do not assume the old video size.
   */
  size?: CanvasSize;
  sample?: TData;
  render: (ctx: InteractiveRenderContext<TData>) => RenderOutput;
}
