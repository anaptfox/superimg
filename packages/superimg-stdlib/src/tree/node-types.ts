import type { MediaSemantic, SpatialSceneSnapshot } from "../scene-types.js";
//! Local copy of the authoring-tree shape. Keep in sync with
//! `@superimg/types` `media-node.ts`. Types stays a leaf package.

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

export interface MediaProps {
  semantic?: MediaSemantic;
  id?: string;
  key?: string | number;
  class?: string;
  className?: string;
  style?: MediaStyleValue;
  motion?: MediaMotionValue;
}

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
  readonly props: Readonly<TProps> & MediaAttributes;
  readonly children: readonly MediaChild[];
  readonly key?: string;
  readonly layout?: MediaLayout;
  /** Internal authored-scene materializer. Portable packets never serialize this function. */
  readonly sceneResolver?: (options: {readonly prefix?:string;readonly runtime?:import("../scene-types.js").SceneRuntimeInput}) => MediaNode;
  readonly sceneSnapshot?: SpatialSceneSnapshot;
  readonly sceneSnapshots?: readonly SpatialSceneSnapshot[];
}

export type MediaNode = MediaElement;
