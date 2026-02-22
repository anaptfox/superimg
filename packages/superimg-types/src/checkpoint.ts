//! Checkpoint type definitions for navigation and markers

/**
 * A checkpoint represents a navigable position in the timeline.
 * Can be an explicit marker or runtime-added position.
 */
export interface Checkpoint {
  /** Unique identifier */
  id: string;
  /** Global frame number */
  frame: number;
  /** Time in seconds */
  time: number;
  /** Display label */
  label?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
  /** Source of this checkpoint */
  source: CheckpointSource;
}

/**
 * Identifies the source/origin of a checkpoint
 */
export type CheckpointSource =
  | { type: "marker"; markerId: string }
  | { type: "runtime" };

/**
 * A marker defines a checkpoint at authoring time.
 * Markers can reference absolute positions.
 */
export interface Marker {
  /** Unique identifier */
  id: string;
  /** Position in the timeline */
  at: MarkerPosition;
  /** Display label */
  label?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Defines where a marker is positioned in the timeline
 */
export type MarkerPosition =
  | { type: "frame"; value: number }
  | { type: "time"; value: number };
