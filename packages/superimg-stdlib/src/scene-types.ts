//! Shared presentation meaning, independent of interactive hosts and DOM.
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
import type { MediaElement, MediaNode, MediaProps } from "./tree/node-types.js";

export type SceneNodeId = string;

export interface SceneTransform {
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
}

export interface SceneAnimation {
  /** Built-ins include `fadeIn` and `pulse`; renderers may add more. */
  type: string;
  /** Normalized animation progress when the author controls it explicitly. */
  progress?: number;
  durationMs?: number;
  easing?: string;
  iterations?: number;
  intensity?: number;
}

export interface SceneNodeStatePatch {
  visible?: boolean;
  opacity?: number;
  transform?: SceneTransform;
  animation?: SceneAnimation | null;
  /** Renderer-neutral, JSON-shaped semantic properties. */
  properties?: JsonObject;
}

export interface SceneNodeDefinition {
  id: SceneNodeId;
  /** Semantic kind, for example `layer`, `character`, `wallet`, or `label`. */
  kind?: string;
  /** Optional semantic role independent of visual kind. */
  role?: string;
  /** Parent node ID. Parents may be registered after children. */
  parent?: SceneNodeId | null;
  tags?: readonly string[];
  label?: string;
  /** Optional domain state label (for example `selected` or `hypothesis-a`). */
  state?: string;
  /** Whether camera transforms affect this node. Defaults to `world`. */
  space?: "world" | "screen";
  /**
   * Opt-in host-interceptable actions (P2). Declared targets only —
   * no arbitrary template scripts. Serialized as `data-si-actions`.
   */
  actions?: readonly string[];
  initial?: SceneNodeStatePatch;
  metadata?: JsonObject;
}

export interface SceneFadeInOptions {
  progress?: number;
  durationMs?: number;
  easing?: string;
}

export interface ScenePulseOptions {
  progress?: number;
  durationMs?: number;
  easing?: string;
  iterations?: number;
  intensity?: number;
}

export type SceneOperation =
  | { readonly type: "show"; readonly target: SceneNodeId }
  | { readonly type: "hide"; readonly target: SceneNodeId }
  | {
      readonly type: "fadeIn";
      readonly target: SceneNodeId;
      readonly options?: SceneFadeInOptions;
    }
  | {
      readonly type: "pulse";
      readonly target: SceneNodeId;
      readonly options?: ScenePulseOptions;
    }
  | {
      readonly type: "set";
      readonly target: SceneNodeId;
      readonly value: SceneNodeStatePatch;
    };

export interface SceneCameraPatch {
  x?: number;
  y?: number;
  zoom?: number;
  rotation?: number;
  fit?: { target: SceneNodeId; padding?: number } | null;
  follow?: { target: SceneNodeId } | null;
}

export interface SceneCameraSnapshot {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly rotation: number;
  readonly fit: Readonly<{ target: SceneNodeId; padding?: number }> | null;
  readonly follow: Readonly<{ target: SceneNodeId }> | null;
}

export interface SceneStateDefinition {
  readonly operations: readonly SceneOperation[];
  readonly camera?: SceneCameraPatch;
}

/**
 * Author-friendly state input. `nodes` is normalized to ordered `set`
 * operations, so serialized snapshots have one deterministic representation.
 */
export interface SceneStateInput {
  operations?: readonly SceneOperation[];
  nodes?: Readonly<Record<SceneNodeId, SceneNodeStatePatch>>;
  camera?: SceneCameraPatch;
}

export interface SceneNodeSnapshot {
  readonly id: SceneNodeId;
  readonly kind: string;
  readonly role: string | null;
  readonly label: string | null;
  readonly state: string | null;
  readonly space: "world" | "screen";
  readonly parentId: SceneNodeId | null;
  readonly childIds: readonly SceneNodeId[];
  readonly tags: readonly string[];
  /** Declared host actions (empty when none). */
  readonly actions: readonly string[];
  readonly visible: boolean;
  readonly opacity: number;
  readonly transform: Readonly<SceneTransform>;
  readonly animation: Readonly<SceneAnimation> | null;
  readonly properties: Readonly<JsonObject>;
  readonly metadata: Readonly<JsonObject>;
}

/** Immutable, renderer-neutral semantic description of one rendered frame. */
export interface SceneSnapshot {
  readonly schemaVersion: 0;
  readonly spatial?: readonly SpatialSceneSnapshot[];
  readonly sceneId: string;
  readonly activeState: string | null;
  readonly rootIds: readonly SceneNodeId[];
  /** Registration order is stable and therefore safe for deterministic output. */
  readonly nodes: readonly SceneNodeSnapshot[];
  readonly states: Readonly<Record<string, SceneStateDefinition>>;
  readonly camera: SceneCameraSnapshot;
}

export interface SceneQuery {
  id?: SceneNodeId;
  kind?: string;
  role?: string;
  tag?: string;
  tags?: readonly string[];
  parentId?: SceneNodeId | null;
  visible?: boolean;
  state?: string;
  space?: "world" | "screen";
}

export interface SceneSnapshotOptions {
  sceneId?: string;
}

/** Runtime-selected overrides applied after the template's frame-local intent. */
export interface SceneRuntimeInput {
  state?: string;
  operations?: readonly SceneOperation[];
  camera?: SceneCameraPatch;
}

/** Input to a renderer that projects semantic state onto authored markup. */
export interface SceneStyleRendererInput {
  readonly html: string;
  readonly scene: SceneSnapshot;
  readonly medium: "html" | "svg";
  /** Renderer-defined style profile, for example `blueprint` or `paper`. */
  readonly style?: string;
}

/**
 * Semantic style boundary. It is intentionally separate from rasterizers and
 * encoders: a style renderer maps meaning to markup, not markup to pixels.
 */
export interface SceneStyleRenderer {
  readonly id: string;
  render(input: SceneStyleRendererInput): string;
}

export interface SceneNodeBinding {
  readonly id: SceneNodeId;
  /** Safe `data-si-*` attributes for direct interpolation into an HTML tag. */
  readonly attrs: string;
  /** Annotate the first root element, with a display-contents fallback wrapper. */
  html(html: string): string;
  /** Bind a typed visual node without converting its descendants into markup. */
  element<T extends MediaElement>(element: T): T;
  show(): SceneNodeBinding;
  hide(): SceneNodeBinding;
  fadeIn(options?: SceneFadeInOptions): SceneNodeBinding;
  pulse(options?: ScenePulseOptions): SceneNodeBinding;
  set(value: SceneNodeStatePatch): SceneNodeBinding;
}

export interface SceneCameraAuthoring {
  set(value: SceneCameraPatch): SceneCameraAuthoring;
  pan(x: number, y: number): SceneCameraAuthoring;
  zoom(value: number): SceneCameraAuthoring;
  rotate(value: number): SceneCameraAuthoring;
  fit(
    target: SceneNodeId,
    options?: { padding?: number },
  ): SceneCameraAuthoring;
  follow(target: SceneNodeId): SceneCameraAuthoring;
  clearFit(): SceneCameraAuthoring;
  clearFollow(): SceneCameraAuthoring;
}

export interface SceneAuthoring {
  readonly camera: SceneCameraAuthoring;

  node(
    id: SceneNodeId,
    options?: Omit<SceneNodeDefinition, "id">,
  ): SceneNodeBinding;
  node(
    id: SceneNodeId,
    html: string,
    options?: Omit<SceneNodeDefinition, "id">,
  ): string;

  layer(
    id: SceneNodeId,
    options?: Omit<SceneNodeDefinition, "id" | "kind">,
  ): SceneNodeBinding;
  layer(
    id: SceneNodeId,
    html: string,
    options?: Omit<SceneNodeDefinition, "id" | "kind">,
  ): string;

  /** Register metadata without forcing an HTML wrapper. */
  register(definition: SceneNodeDefinition): SceneNodeBinding;

  state(name: string, definition: SceneStateInput): SceneAuthoring;
  states(
    definitions: Readonly<Record<string, SceneStateInput>>,
  ): SceneAuthoring;
  use(name: string): SceneAuthoring;

  show(target: SceneNodeId): SceneAuthoring;
  hide(target: SceneNodeId): SceneAuthoring;
  fadeIn(target: SceneNodeId, options?: SceneFadeInOptions): SceneAuthoring;
  pulse(target: SceneNodeId, options?: ScenePulseOptions): SceneAuthoring;
  set(target: SceneNodeId, value: SceneNodeStatePatch): SceneAuthoring;
  apply(...operations: readonly SceneOperation[]): SceneAuthoring;

  /** A facade sharing this frame's collector but reporting another scene ID. */
  scope(sceneId: string): SceneAuthoring;
  snapshot(options?: SceneSnapshotOptions): SceneSnapshot;
}

/** Useful to renderer implementations accepting open-ended semantic values. */
export type SceneSemanticValue = JsonValue;

/** Local art/presentation coordinates, not collision geometry. */
export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}
export interface ScenePosition extends ScenePoint {
  readonly z?: number;
}
export interface SceneBounds extends ScenePoint {
  readonly width: number;
  readonly height: number;
}
export interface SceneMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}
export interface VisualAnchor extends ScenePoint {
  readonly angle?: number;
}
export interface VisualPart {
  readonly id: string;
  readonly content: MediaNode;
  readonly bounds: SceneBounds;
  readonly placement?: ScenePosition;
  readonly band?: number;
  readonly depthBias?: number;
  readonly order?: number;
}
export interface VisualFrame {
  readonly parts: readonly VisualPart[];
  readonly anchors?: Readonly<Record<string, VisualAnchor>>;
  readonly bounds?: SceneBounds;
}
export interface VisualDefinition<TData> {
  readonly kind: "@foxworth/superimg/visual";
  readonly id: string;
  readonly render: (context: { readonly data: Readonly<TData> }) => VisualFrame;
}
/** Portable immutable data used by a bound subject. Revision references are host supplied. */
export type SubjectValue = string | number | boolean | null
  | readonly SubjectValue[] | { readonly [key: string]: SubjectValue };
export interface SubjectBinding {
  readonly entityId: string;
  readonly definitionId: string;
  readonly designRevision: string;
  /** Accepted parameters retained so design substitutions can be detected, not just labelled. */
  readonly design: SubjectValue;
  readonly appearanceId?: string;
  readonly styleRevision?: string;
}
export interface InstanceProps<TData> {
  readonly semantic?: Omit<MediaSemantic, "id">;
  readonly id: string;
  readonly entityId?: string;
  readonly of: VisualDefinition<TData>;
  readonly data: TData;
  readonly binding?: SubjectBinding;
  readonly at?: ScenePosition;
  readonly transform?: SceneTransform;
  readonly attachTo?: { readonly instance: string; readonly anchor: string };
}
export interface SceneProjection {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly z: readonly [number, number];
  readonly depth?: readonly [number, number, number];
}
export interface SpatialCamera {
  readonly x?: number;
  readonly y?: number;
  readonly zoom?: number;
  readonly rotation?: number;
  readonly fit?: {
    readonly targets: readonly string[];
    readonly padding?: number;
  };
}
export interface SpatialSceneProps {
  readonly semantic?: Omit<MediaSemantic, "id">;
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly projection?: SceneProjection;
  readonly camera?: SpatialCamera;
  readonly clip?: boolean;
}
export type SceneHitRegion =
  | ({ readonly kind: "rect" } & SceneBounds)
  | ({ readonly kind: "circle"; readonly radius: number } & ScenePoint);
export interface MediaSemantic extends Omit<
  SceneNodeDefinition,
  "id" | "initial"
> {
  readonly id?: string;
  readonly hit?: SceneHitRegion;
}
export interface ResolvedVisualPart {
  readonly id: string;
  readonly instanceId: string;
  readonly bounds: SceneBounds;
  readonly matrix: SceneMatrix;
  readonly band: number;
  readonly depth: number;
  readonly order: number;
  readonly opaque: boolean;
}
export interface ResolvedVisualInstance {
  readonly hit?: {
    readonly region: SceneHitRegion;
    readonly matrix: SceneMatrix;
    readonly bounds: SceneBounds;
  };
  readonly id: string;
  readonly entityId: string | null;
  readonly definitionId: string;
  readonly binding?: SubjectBinding;
  readonly matrix: SceneMatrix;
  readonly bounds: SceneBounds;
  readonly anchors: Readonly<Record<string, VisualAnchor>>;
  readonly attachment: {
    readonly instance: string;
    readonly anchor: string;
  } | null;
}
export interface SpatialSceneSnapshot extends SceneSnapshot {
  readonly instances: readonly ResolvedVisualInstance[];
  readonly parts: readonly ResolvedVisualPart[];
  readonly cameraMatrix: SceneMatrix;
  readonly viewport: SceneBounds;
}
