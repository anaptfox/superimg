//! Portable authored review intentions. Hosts own capture and evaluation.

import type { JsonObject } from "./json.js";

export interface ReviewObservationContext {
  readonly frame: number;
  readonly seconds: number;
  /** Inclusive root authored-media clock. Child scene clocks require authored probes. */
  readonly timelineSeconds: number;
  /** Actual rendered frame progress; requested selectors may round to this frame. */
  readonly progress: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ReviewBeat {
  readonly id: string;
  readonly label: string;
  /** Explicit seconds/ms, f:N, or normalized progress. */
  readonly at: string;
  /** Short review clip, preserving the original media's time coordinates. */
  readonly range?: readonly [string, string];
  /** Optional detail evidence. Full-frame evidence is always retained. */
  readonly crop?: Readonly<{ x: number; y: number; width: number; height: number }>;
}

export interface ReviewCheck {
  readonly id: string;
  readonly label: string;
  /** Omit to evaluate at every beat. */
  readonly beat?: string;
  /** Dot-separated path in the author-reported observation. */
  readonly metric: string;
  readonly min?: number;
  readonly max?: number;
  readonly equals?: string | number | boolean | null;
}

export interface ReviewPlan {
  readonly schemaVersion: 1;
  readonly beats: readonly ReviewBeat[];
  /** Pure frame observation; reports authored facts, never an aesthetic verdict. */
  readonly observe?: (context: ReviewObservationContext) => JsonObject;
  readonly checks?: readonly ReviewCheck[];
}
