//! Retained authored media composition. This is deliberately structural: a
//! Program keeps named occurrences available to hosts after it is projected.

import type { DeterministicMediaDefinition } from "./define.js";
import type { Duration, ResolvedTransition, Transition } from "./types.js";
import type { JsonObject } from "./json.js";

/** A reusable authored work, before a host chooses a projection. */
export type Program = SequenceProgram | TogetherProgram | ChooseProgram;

// Occurrences may have independent data contracts. Erase only fields whose
// types depend on the child's data while keeping its deterministic media
// identity and config. A definition with a narrower resolve input must remain
// usable as a child without claiming that it accepts arbitrary root data.
export type CompositionMedia = Omit<
  DeterministicMediaDefinition<never>,
  "sample" | "editions" | "variants"
> & {
  readonly sample?: unknown;
  readonly editions?: unknown;
  readonly variants?: unknown;
};

/** Runtime contract implemented by `defineInteractive()` without making types depend on that package. */
export interface InteractiveCompositionRuntime {
  readonly media: CompositionMedia;
  setScene(value: unknown): void;
  getSnapshot(): unknown;
  subscribe(listener: (snapshot: unknown) => void): () => void;
  attachActions(
    container: HTMLElement,
    getFrame: () => number,
    listener: (event: { readonly action: string; readonly nodeId: string; readonly frame: number }) => void,
  ): () => void;
}

/** Structural leaf protocol for interactive package definitions. */
export interface InteractiveCompositionChild {
  readonly kind: "interactive";
  createCompositionRuntime(): InteractiveCompositionRuntime;
}

export type CompositionContent = Program | CompositionMedia | InteractiveCompositionChild;

/** How a child canvas is mapped onto its projection target. */
export type CompositionFit = "contain" | "cover" | "reflow";

/** One named occurrence of a work in a sequence. */
export interface Use {
  readonly id: string;
  readonly content: CompositionContent;
  /** Still duration, or total duration of a nested Program (holding its final frame). */
  readonly hold?: Duration;
  /** A shallow patch over this child's sample data, inherited by nested leaves. */
  readonly data?: JsonObject;
  /** Required when this child canvas differs from its timed output canvas. */
  readonly fit?: CompositionFit;
  /** Select one declared child data patch for this occurrence. */
  readonly variant?: string;
  /** Select one declared child art-direction override for this occurrence. */
  readonly edition?: string;
  /** Non-destructive trim window (`in`/`out`) applied to an animated child occurrence. */
  readonly trim?: Readonly<{ readonly in?: Duration; readonly out?: Duration }>;
  /** Optional enter transition applied at the start of this occurrence. */
  readonly enter?: Transition;
  /** Optional exit transition applied at the end of this occurrence. */
  readonly exit?: Transition;
}

export interface SequenceProgram {
  readonly op: "sequence";
  readonly parts: readonly Use[];
}

/** Concurrently placed named children on one parent clock. */
export interface TogetherProgram {
  readonly op: "together";
  readonly parts: readonly PlacedUse[];
  /** What happens after a placed child reaches its own end. */
  readonly end: "hold" | "hide";
  /** Stable authored canvas for this reusable group. Omission inherits its placement canvas. */
  readonly size?: Readonly<{ width: number; height: number }>;
}

export interface PlacedUse extends Use {
  readonly rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly fit: CompositionFit;
}

export type CompositionPlacement = Readonly<{
  /** Qualified occurrence path of the enclosing together() group. */
  groupPath: string;
  rect: Readonly<{ x: number; y: number; width: number; height: number }> & JsonObject;
  /** Canvas containing this placement, before its parent fits the group. */
  groupSize?: Readonly<{ width: number; height: number }>;
  fit: CompositionFit;
  end: "hold" | "hide";
}> & JsonObject;

/** Named alternatives; a timed projection requires an explicit route. */
export interface ChooseProgram {
  readonly op: "choose";
  readonly paths: Readonly<Record<string, CompositionContent>>;
}

/** A leaf occurrence on the deterministic, selected linear projection. */
export interface CompositionLeafSchedule {
  readonly path: string;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly totalFrames: number;
  /** Authored content stops here when a parent together() holds its final frame. */
  readonly contentEndFrame?: number;
  readonly kind: "video" | "image" | "svg";
  readonly width: number;
  readonly height: number;
  /** How the authored child canvas maps to the timed output canvas. */
  readonly fit?: CompositionFit;
  /** Explicit placement when this occurrence belongs to together(). */
  readonly placement?: CompositionPlacement;
  /** Outer-to-inner coordinate transforms for nested together() groups. */
  readonly placementChain?: readonly CompositionPlacement[];
  /** Explicit rendition selection retained for inspection and re-projection. */
  readonly variantId?: string;
  /** Explicit rendition selection retained for inspection and re-projection. */
  readonly editionId?: string;
  readonly fps?: number;
  /** Source-frame in-point when this occurrence is trimmed via `Use.trim`. */
  readonly trimInFrames?: number;
  /** Full un-trimmed source frame count (at child fps) when trimmed via `Use.trim`. */
  readonly sourceTotalFrames?: number;
  /** Resolved enter transition on the timed output clock. */
  readonly enter?: ResolvedTransition;
  /** Resolved exit transition on the timed output clock. */
  readonly exit?: ResolvedTransition;
}

/** Integer clock data retained with a timed projection. All intervals are [start, end). */
export interface CompositionSchedule {
  readonly totalFrames: number;
  readonly fps: number;
  /** Explicit deterministic branch selections keyed by qualified choice path. */
  readonly selectedRoutes?: Readonly<Record<string, string>>;
  readonly leaves: readonly CompositionLeafSchedule[];
}

/** Metadata attached to a timed MediaDefinition without flattening its Program. */
export interface RetainedComposition {
  readonly schemaVersion: 0;
  readonly program: Program;
  /** Fixed output canvas of this timed projection. */
  readonly outputSize: Readonly<{ width: number; height: number }>;
  readonly schedule: CompositionSchedule;
}

/** Entry payload for collection or Player data applied to named leaf occurrences. */
export type CompositionEntryData = JsonObject & {
  id?: string;
  uses?: Record<string, JsonObject>;
};
