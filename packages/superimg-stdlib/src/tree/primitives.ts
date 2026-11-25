//! Layout primitives — return MediaElements; layout runs in lower().

import type { MediaChild, MediaElement, MediaProps } from "./node-types.js";
import { h, isMediaElement } from "./h.js";
import type { SafeAreaPreset } from "../safe-area.js";

export type PadValue =
  | number
  | {
      x?: number;
      y?: number;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

export type TextVariant = "display" | "title" | "body" | "caption" | "label";

export interface BoxProps extends MediaProps {
  width?: number | "fill";
  height?: number | "fill";
  x?: number;
  y?: number;
  pad?: PadValue;
  fill?: string;
  radius?: number | string;
  overflow?: "hidden" | "visible";
}

function isPropsBag(value: unknown): value is MediaProps {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  if (isMediaElement(value)) return false;
  return true;
}

function split<P extends MediaProps>(
  propsOrChild: P | MediaChild | undefined,
  rest: MediaChild[],
): { props: P; children: MediaChild[] } {
  if (propsOrChild === undefined) return { props: {} as P, children: rest };
  if (isPropsBag(propsOrChild)) return { props: propsOrChild as P, children: rest };
  return { props: {} as P, children: [propsOrChild, ...rest] };
}

export interface FrameProps extends BoxProps {}

export function Frame(
  propsOrChild?: FrameProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"Frame", FrameProps> {
  const { props, children } = split<FrameProps>(propsOrChild, rest);
  return h("Frame", props, ...children);
}

export interface StackProps extends Omit<BoxProps, "x" | "y"> {
  direction?: "row" | "column";
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
}

/** Centering/distribution needs a definite box; otherwise the stack shrinks and the alignment is a no-op. */
function impliedStackFill(props: StackProps): { width?: "fill"; height?: "fill" } {
  const direction = props.direction === "row" ? "row" : "column";
  const justify = props.justify;
  const align = props.align;
  const needsMain =
    justify === "center" || justify === "end" || justify === "space-between";
  const needsCross = align === "center" || align === "end";
  const fill: { width?: "fill"; height?: "fill" } = {};
  if (props.width === undefined && (direction === "row" ? needsMain : needsCross)) {
    fill.width = "fill";
  }
  if (props.height === undefined && (direction === "row" ? needsCross : needsMain)) {
    fill.height = "fill";
  }
  return fill;
}

export function Stack(
  propsOrChild?: StackProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"Stack", StackProps> {
  const { props, children } = split<StackProps>(propsOrChild, rest);
  const positioned = props as StackProps & { x?: unknown; y?: unknown };
  if (positioned.x !== undefined || positioned.y !== undefined) {
    throw new Error("Stack cannot take x/y — wrap in a Frame to position or slide");
  }
  return h("Stack", { direction: "column", ...impliedStackFill(props), ...props }, ...children);
}

export interface TextProps extends MediaProps {
  /** Character reveal progress (0..1) for typewriter / progressive reveal. */
  reveal?: number;
  variant?: TextVariant;
  size?: number;
  color?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
}

/** Default ink so uncolored Text is not browser-black on a dark composite floor. */
export const DEFAULT_TEXT_COLOR = "#111827";

export function Text(
  propsOrChild?: TextProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"Text", TextProps> {
  const { props, children } = split<TextProps>(propsOrChild, rest);
  return h("Text", { variant: "body", color: DEFAULT_TEXT_COLOR, ...props }, ...children);
}

export interface SafeProps extends BoxProps {
  preset?: SafeAreaPreset;
}

export function Safe(
  propsOrChild?: SafeProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"Safe", SafeProps> {
  const { props, children } = split<SafeProps>(propsOrChild, rest);
  return h("Safe", { preset: "broadcast", ...props }, ...children);
}

export interface SpacerProps extends MediaProps {
  width?: number | "fill";
  height?: number | "fill";
}

export function Spacer(props: SpacerProps = {}): MediaElement<"Spacer", SpacerProps> {
  return h("Spacer", props);
}

export type FillGradient = {
  kind: "linear" | "radial";
  at?: string;
  /** Ellipse size for radial fills, e.g. `"52% 44%"`. */
  size?: string;
  angle?: number | string;
  stops: string[];
};

export interface FillProps extends BoxProps {
  color?: string;
  gradient?: FillGradient;
}

export function Fill(props: FillProps = {}): MediaElement<"Fill", FillProps> {
  return h("Fill", { width: "fill", height: "fill", ...props });
}

export interface ImageProps extends BoxProps {
  src: string;
  fit?: "cover" | "contain" | "fill";
  kenBurns?:
    | number
    | {
        progress: number;
        zoomFrom?: number;
        zoomTo?: number;
        overlay?: string;
        position?: string;
        overflow?: number;
      };
  overlay?: string;
}

export function Image(props: ImageProps): MediaElement<"Image", ImageProps> {
  return h("Image", { width: "fill", height: "fill", fit: "cover", ...props });
}

export interface VideoProps extends BoxProps {
  src: string;
  /** Frame-synchronized video markup supplied by `std.video.sync()`. */
  html?: string;
  at?: number;
  start?: number;
  playbackRate?: number;
  fit?: "cover" | "contain" | "fill";
  muted?: boolean;
  loop?: boolean;
  poster?: string;
  fps?: number;
}

export function Video(props: VideoProps): MediaElement<"Video", VideoProps> {
  return h("Video", { width: "fill", height: "fill", fit: "cover", muted: true, ...props });
}

export interface PlateProps extends BoxProps {
  /** Source clip filename. Compile with `superimg plate <file>`. */
  src: string;
  fit?: "cover" | "contain" | "fill";
}

export function Plate(props: PlateProps): MediaElement<"Plate", PlateProps> {
  return h("Plate", { width: "fill", height: "fill", fit: "cover", ...props });
}

export interface HtmlProps extends BoxProps {
  html: string;
}

export function Html(props: HtmlProps): MediaElement<"Html", HtmlProps> {
  if (typeof props.html !== "string") {
    throw new Error("Html() requires an html string");
  }
  return h("Html", { width: "fill", height: "fill", ...props });
}
