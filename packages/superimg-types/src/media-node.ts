import type { MediaSemantic, SpatialSceneSnapshot } from "./scene.js";
//! Authoring tree — render() returns a node; the runtime lowers to HTML/SVG.
//! Raw markup is available only through the explicit Html() node.

export const MEDIA_ELEMENT = "@foxworth/superimg/element" as const;

export interface MediaLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MediaStylePropertyValue = string | number | null | undefined;

export interface MediaStyleObject {
  readonly [property: string]: MediaStylePropertyValue;
}

/** Structural subset shared by director motion results. */
export interface MediaMotionValue {
  readonly style: string;
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly rotate?: number;
  readonly blur?: number;
  readonly opacity?: number;
  readonly phase?: "before" | "entering" | "steady" | "exiting" | "after";
}

export type MediaStyleValue =
  | string
  | MediaStyleObject
  | MediaMotionValue
  | readonly MediaStyleValue[];

/** Props shared by semantic constructors. Deliberately closed to catch typos. */
export interface MediaProps {
  semantic?: MediaSemantic;
  id?: string;
  key?: string | number;
  class?: string;
  className?: string;
  style?: MediaStyleValue;
  motion?: MediaMotionValue;
  opacity?: number;
  blendMode?: "normal" | "multiply" | "screen" | "overlay";
}

/** Open attribute bag used only by the low-level `h()` escape hatch. */
export type MediaAttributes = MediaProps & {
  readonly [attribute: string]: unknown;
};

export type MediaChild =
  | MediaNode
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly MediaChild[];

export interface MediaElement<
  TType extends string = string,
  TProps extends MediaProps = MediaProps,
> {
  readonly $$typeof: typeof MEDIA_ELEMENT;
  readonly type: TType;
  /** Runtime attributes stay inspectable; semantic constructors still accept closed props. */
  readonly props: Readonly<TProps> & MediaAttributes;
  readonly children: readonly MediaChild[];
  readonly key?: string;
  readonly layout?: MediaLayout;
  /** Resolved, handler-free spatial scene packet. */
  /** Internal authored-scene materializer. Portable packets never serialize this function. */
  readonly sceneResolver?: (options: {readonly prefix?:string;readonly runtime?:import("./scene.js").SceneRuntimeInput}) => MediaNode;
  readonly sceneSnapshot?: SpatialSceneSnapshot;
  readonly sceneSnapshots?: readonly SpatialSceneSnapshot[];
}

/** Branded authoring-tree root. */
export type MediaNode = MediaElement;

/** Public `render(ctx)` return type. */
export type RenderOutput = MediaNode;

export function isMediaElement(value: unknown): value is MediaElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as MediaElement).$$typeof === MEDIA_ELEMENT &&
    typeof (value as MediaElement).type === "string"
  );
}

export function isRenderOutput(value: unknown): value is RenderOutput {
  return isMediaElement(value);
}
