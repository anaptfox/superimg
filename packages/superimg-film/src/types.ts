import type { FilmScript, ScriptDocument } from "@foxworth/superimg-script";
import type { SafeAreaInsets, SafeAreaPreset } from "@superimg/stdlib/safe-area";
import type {
  AudioClip,
  AudioMixOptions,
  AudioTimeline,
  CanvasSize,
  Duration,
  FontInput,
  MediaChild,
  MediaElement,
  NarrationPlan,
  ResolveBreakdown,
  ResolveCue,
  ResolveCueFinding,
  ResolveShotBreakdown,
  TranscriptWord,
} from "@superimg/types";
import type { VectorGroupProps } from "@superimg/stdlib/tree";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type FilmFit = "contain" | "cover" | "focus";
export type FilmSafeArea = SafeAreaPreset | SafeAreaInsets;

export type TrimShotOptions = {
  /** Source-time in-point in seconds (`>= 0`). */
  in: number;
  /** Optional source-time out-point in seconds (`> in`). */
  out?: number;
  /** Optional full source duration in seconds used to normalize `ctx.u`. */
  sourceDuration?: number;
};

export type PlaceBubbleOptions = {
  /** Speaker head position in output canvas pixels. */
  head: Point;
  /** Bubble dimensions in output canvas pixels. */
  size: CanvasSize;
  /** Safe content rectangle in output canvas pixels. */
  safeBox: Rect;
  /** Minimum clearance between head and tail tip (default `12`). */
  gap?: number;
  /** Bubble tail height in pixels (default `14`). */
  tailHeight?: number;
  /** Minimum horizontal inset of the tail from the bubble edges (default `18`). */
  tailMargin?: number;
  /** Boxes already occupied by earlier bubbles on the same frame. */
  occupied?: readonly Rect[];
  /** Preferred side relative to the head (default `"above"`). */
  prefer?: "above" | "below";
};

export type BubblePlacement = {
  x: number;
  y: number;
  tailX: number;
  tailSide: "bottom" | "top";
  box: Rect;
};

export type SpeechAudioClip = {
  src: string;
  /** Measured speech duration in seconds; drives the speech cue end when `at` has no explicit end. */
  duration?: number;
  volume?: number;
  trim?: { in?: Duration; out?: Duration };
  fadeIn?: Duration;
  fadeOut?: Duration;
  transcript?: TranscriptWord[];
};

export type FilmMusicInput =
  | string
  | {
      src: string;
      volume?: number;
      loop?: boolean;
      trim?: { in?: Duration; out?: Duration };
      fadeIn?: Duration;
      fadeOut?: Duration;
    };

export type FilmAudioOptions = {
  /** Background music bed (role `"music"`, loops by default, auto-ducks under voice). */
  music?: FilmMusicInput;
  /** Per-speech-id voice clips or a `NarrationPlan` from `planNarration()`. */
  speech?: Readonly<Record<string, SpeechAudioClip>> | NarrationPlan;
  /** Soundboard map keyed by cue name referenced from `sfx:` header fields on shots or speech blocks. */
  sfx?: Readonly<Record<string, string | Omit<AudioClip, "at">>>;
  /** Additional raw audio clips placed on the film timeline. */
  clips?: readonly AudioClip[];
  /** Optional mix/ducking override. Defaults to `{ ducking: true, duckingLevel: 0.25 }` when music + voice coexist. */
  mix?: AudioMixOptions;
};

export type ShotTransition = {
  type: "cut" | "dissolve" | "dip";
  /** Transition duration in seconds (defaults to `0.35` for dissolve, `0.4` for dip). */
  duration?: number;
  /** Dip color for `type: "dip"` (defaults to series background or `"#000"`). */
  color?: string;
};

export type TitleContext = {
  screen: CanvasSize;
  safeBox: Rect;
};

export type BubbleLayoutContext = {
  screen: CanvasSize;
  safeBox: Rect;
  /** Authored shot obstacles projected into output canvas pixels. */
  avoid: readonly Rect[];
  /** True when the film title painter is active on this frame. */
  titleActive: boolean;
};

export type FilmEdition = {
  size: CanvasSize;
  stage?: CanvasSize;
  fit?: FilmFit;
  safeArea?: FilmSafeArea;
  background?: string;
  ending?: "cut" | "fade";
  transition?: ShotTransition;
  shapeRendering?: Series["shapeRendering"];
  bubble?: (b: BubbleInput) => ShotArt;
  layoutBubbles?: (active: readonly BubbleInput[], ctx: BubbleLayoutContext) => ShotArt;
  card?: (c: CardInput) => ShotArt;
  drawTitle?: (t: number, title: string, ctx: TitleContext) => ShotArt;
};
export type ShotArt = MediaChild[] | string;
export type ShotResult = ShotArt | {
  art: ShotArt;
  heads?: Record<string, Point>;
  /** Explicit prop names present in this shot (enables continuity checks on SVG-string shots). */
  props?: readonly string[];
  /** Obstacles in stage coordinates after any shot-local camera, before film fit. */
  obstacles?: readonly Rect[];
};

/** A scheduled speech or card block, in seconds from the start of its shot. */
export type ShotLine = {
  id: string | null;
  kind: "speech" | "card";
  /** The speaker, for a speech block. */
  who?: string;
  /** Reading pace (`say`, `beat`, etc.), for a speech block. */
  pace?: string;
  /** The spoken or card lines. */
  lines: readonly string[];
  /** Open header fields from the script block (e.g. `do`, `mood`, `sfx`, `react`). */
  fields: Readonly<Record<string, string>>;
  start: number;
  typed: number;
  end: number;
};

export type ShotContext<Data = unknown> = {
  id: string;
  t: number;
  u: number;
  duration: number;
  /** Output canvas dimensions in pixels (changes across responsive sizes / editions). */
  screen: CanvasSize;
  /** Shot description text from the script. */
  text: string;
  /** Enclosing Markdown section heading above the shot, if any. */
  section: string | null;
  /** Open header fields from the shot block (e.g. `mood`, `camera`, `music`, `sfx`). */
  fields: Readonly<Record<string, string>>;
  /** The speech and card blocks scheduled in this shot, so art can react to dialogue. */
  lines: readonly ShotLine[];
  data: Data;
};

export type Shot<Data = unknown> = (s: ShotContext<Data>) => ShotResult;

/** Data-first shot resolver (zero untrusted user code execution). */
export interface ShotResolver<Data = unknown> {
  has(id: string): boolean;
  render(id: string, ctx: ShotContext<Data>): ShotResult | undefined;
}

export type ShotsSource<Data = unknown> =
  | readonly Record<string, unknown>[]
  | Readonly<Record<string, Shot<Data>>>
  | ShotResolver<Data>;

export type CastPlacement = {
  size?: number;
  flip?: boolean;
  pose?: string;
  walk?: boolean;
  /** Raise the sprite and its head by this many stage units. A rig's shadow stays on the ground. */
  lift?: number;
  [key: string]: unknown;
};

export type CastMember = (t: number, at: Point, o?: CastPlacement) => MediaChild;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PropDrawer<Args extends readonly any[] = []> = (
  ...args: Args
) => MediaElement<"VectorGroup", VectorGroupProps>;

export type ShotBreakdown = ResolveShotBreakdown;
export type FilmBreakdown = ResolveBreakdown;

export type ContinuityOptions = {
  /**
   * Flag a prop that reappears in a shot after being absent for this many or
   * more intervening shots. Off by default.
   */
  replantAfter?: number;
  /**
   * Flag when a speaker addresses or speaks in a shot with a cast member they
   * have never shared an earlier shot with. Off by default.
   */
  introductions?: boolean;
};

export type BubbleInput = {
  id: string | null;
  who: string;
  /** Speaker display label from `cast(..., { label })`, defaulting to `who.toUpperCase()`. */
  displayName: string;
  /** Optional series metadata attached to the speaker via `cast(..., { meta })`. */
  castMeta?: Readonly<Record<string, unknown>>;
  lines: readonly string[];
  /** Open header fields from the speech block (e.g. `do`, `mood`, `sfx`). */
  fields: Readonly<Record<string, string>>;
  t: number;
  start: number;
  typed: number;
  end: number;
  index: number;
  head: Point;
  /** Output canvas dimensions in pixels. */
  screen: CanvasSize;
  /** Safe content box in output canvas pixels (from `safeArea`, defaulting to full screen). */
  safeBox: Rect;
  /** Bounding boxes of earlier bubbles already rendered on this same frame. */
  occupied: readonly Rect[];
  /** Authored shot obstacles projected into output canvas pixels. */
  avoid?: readonly Rect[];
};

export type CardInput = {
  id: string | null;
  lines: readonly string[];
  /** Open header fields from the card block. */
  fields: Readonly<Record<string, string>>;
  attribution?: string;
  sign?: string;
  source?: string;
  t: number;
  length: number;
  /** Output canvas dimensions in pixels. */
  screen: CanvasSize;
  /** Safe content box in output canvas pixels (from `safeArea`, defaulting to full screen). */
  safeBox: Rect;
};

export type Series = {
  stage: CanvasSize;
  size?: CanvasSize;
  fps?: number;
  background?: string;
  cast?: readonly CastMember[] | Record<string, CastMember>;
  bubble?: (b: BubbleInput) => ShotArt;
  /** Optional frame-level bubble painter receiving all active speakers on the frame at once. */
  layoutBubbles?: (active: readonly BubbleInput[], ctx: BubbleLayoutContext) => ShotArt;
  card?: (c: CardInput) => ShotArt;
  /** Paints the film title (a string, see `FilmOptions.title`) during the first shot. */
  drawTitle?: (t: number, title: string, ctx: TitleContext) => ShotArt;
  ending?: "cut" | "fade";
  /** Default shot-to-shot transition (`"cut"`, `"dissolve"`, or `"dip"`). Overridable per shot via `transition:` header field. */
  transition?: ShotTransition;
  /** How the stage fits the canvas. Vector art defaults to "contain", SVG-string art to "cover". */
  fit?: FilmFit;
  /** Optional safe-area preset or explicit insets for bubble/card layout. Defaults to full screen. */
  safeArea?: FilmSafeArea;
  /**
   * `shape-rendering` attribute applied to SVG-string wrapper layers.
   * Defaults to `"crispEdges"` for backward compatibility; pass `"auto"` or
   * `"geometricPrecision"` for smooth illustrated/vector stories.
   */
  shapeRendering?: "auto" | "crispEdges" | "geometricPrecision";
  /** Set false when the bubble does not letter the speaker's name, so it needs no glyphs. Default true. */
  bubbleShowsName?: boolean;
  bubbleLimits?: { lines: number; chars: number };
  glyphs?: (text: string) => boolean;
  fonts?: readonly FontInput[];
  inlineCss?: readonly string[];
  stylesheets?: readonly string[];
  /** Continuity supervisor rules checked during `resolve()` / `superimg check`. */
  continuity?: ContinuityOptions;
};

/** Structural input from the script film view. */
type Block = {
  id: string | null;
  section?: string | null;
  fields?: Readonly<Record<string, string>>;
};
export type ShotBlock = Block & {
  kind: "shot";
  hold?: number;
  in?: number;
  still?: number;
  text?: string;
};
type LineBlock = Block & { lines: readonly string[]; at?: { start: number; end?: number } };
export type SpeechBlock = LineBlock & { kind: "speech"; who: string; pace?: string | null };
export type CardBlock = LineBlock & {
  kind: "card";
  attribution?: string | null;
  sign?: string | null;
  source?: string | null;
};
export type ScriptBlock = ShotBlock | SpeechBlock | CardBlock;

export type ScriptModule = {
  version: number;
  hash?: string;
  editHash?: string;
  title?: string | null;
  blocks: readonly ScriptBlock[];
};

/** Accepted script inputs for `film()`: raw Markdown, parsed document, or film view. */
export type FilmScriptInput = string | ScriptDocument | FilmScript | ScriptModule;

/**
 * `title` is the authored string; the painter that draws it is
 * `Series.drawTitle`, so a film can retitle a series without losing its painter.
 * The title defaults to the script's first level-1 heading.
 */
export type FilmOptions<Data> = Series & {
  script: FilmScriptInput;
  shots: ShotsSource<Data>;
  score?: string;
  /** Rich multi-track film audio (structured `FilmAudioOptions`, raw `AudioTimeline`, or `AudioClip[]`). */
  audio?: FilmAudioOptions | AudioTimeline | readonly AudioClip[];
  /** Aspect-ratio editions (e.g. `square`, `portrait`, `landscape`) with optional fit/safeArea/bubble overrides. */
  editions?: Readonly<Record<string, FilmEdition>>;
  title?: string;
  data?: Data;
  /** Optional per-data token map for `{key}` placeholders in dialogue, cards, and title. */
  tokens?: (data: Data) => Readonly<Record<string, string>>;
};

export type FilmShotMark = {
  readonly id: string | null;
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly duration: number;
  readonly still: number;
  readonly section: string | null;
  readonly fields: Readonly<Record<string, string>>;
};

export type FilmSpeechMark = {
  readonly id: string | null;
  readonly shotId: string | null;
  readonly who: string;
  readonly start: number;
  readonly typed: number;
  readonly end: number;
  readonly still: number;
  readonly lines: readonly string[];
  readonly fields: Readonly<Record<string, string>>;
};

export type FilmCardMark = {
  readonly id: string | null;
  readonly shotId: string | null;
  readonly start: number;
  readonly end: number;
  readonly still: number;
  readonly lines: readonly string[];
  readonly fields: Readonly<Record<string, string>>;
};

export type FilmMarks = {
  readonly total: number;
  readonly fps: number;
  readonly shots: readonly FilmShotMark[];
  readonly speech: readonly FilmSpeechMark[];
  readonly cards: readonly FilmCardMark[];
};

export type FilmInspection = {
  readonly duration: number;
  readonly fps: number;
  readonly size: CanvasSize;
  readonly cues: readonly ResolveCue[];
  readonly findings: readonly ResolveCueFinding[];
  readonly breakdown: FilmBreakdown;
  readonly marks: FilmMarks;
};
