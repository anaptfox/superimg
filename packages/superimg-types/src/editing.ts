//! Browser-safe edit contracts for Studio visual editing.
//! Source bindings and operations — no DOM/Node types.

import type { JsonValue } from "./json.js";
import type { MediaIRDiff, MediaIR } from "./media-ir.js";
import type { MediaCoordinates } from "./coordinates.js";

// ---------------------------------------------------------------------------
// Capabilities and reason codes
// ---------------------------------------------------------------------------

/**
 * Machine capability for a source binding.
 * UI only presents exact → Editable, inspect-only → Inspect only, opaque → Opaque.
 */
export type EditCapability =
  | "exact"
  | "inspect-only"
  | "opaque";

/** Three user-facing states only. */
export type EditUiState = "editable" | "inspect-only" | "opaque";

export type EditTimeSpace =
  | "source"
  | "clip"
  | "scene"
  | "parent"
  | "global";

export type EditReasonCode =
  | "animated-transform"
  | "expression-binding"
  | "missing-property"
  | "computed-property"
  | "spread-property"
  | "duplicate-target"
  | "unstable-node"
  | "missing-stable-id"
  | "cross-file-target"
  | "derived-duration"
  | "single-scene-template"
  | "opaque-visual";

// ---------------------------------------------------------------------------
// Tagged frames
// ---------------------------------------------------------------------------

export interface EditFramePoint {
  space: EditTimeSpace;
  frame: number;
  ownerId?: string;
}

export interface EditFrameRange {
  space: EditTimeSpace;
  startFrame: number;
  endFrame: number;
  ownerId?: string;
}

// ---------------------------------------------------------------------------
// Source bindings / manifest
// ---------------------------------------------------------------------------

export interface EditSourceBinding {
  schemaVersion: 0;
  /** Stable identity, e.g. `intro::title#initial.transform.x`. */
  bindingId: string;
  targetId: string;
  propertyPath: string;
  capability: EditCapability;
  reason?: EditReasonCode;
  value?: JsonValue;
  source?: {
    relativePath: string;
    sourceHash: string;
    startByte: number;
    endByte: number;
    syntaxKind: "number-literal" | "string-duration" | "string-literal";
  };
}

export interface EditManifest {
  schemaVersion: 0;
  coordinates: MediaCoordinates;
  intentHash: string;
  summary: {
    exactBindingCount: number;
    inspectOnlyCount: number;
    opaqueCount: number;
  };
  bindings: EditSourceBinding[];
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export interface EditOperationPreconditions {
  intentHash: string;
  sourceHashes: Record<string, string>;
}

/** A requested source frame; presentation acceptance remains host-owned. */
export interface EditFrameObservation {
  readonly frame: number;
  readonly coordinates: MediaCoordinates;
}

export type EditableNodeProperty = "color" | "fill" | "size" | "weight" | "width" | "height" | "src";

export type MediaEditCommand =
  | { schemaVersion: 0; source: string; kind: "set-audio-clip-placement"; target: { clipId: string; bindingId: string }; value: { atSeconds: number }; expected: EditOperationPreconditions }
  | { schemaVersion: 0; source: string; kind: "set-node-property"; target: { nodeId: string; property: EditableNodeProperty; bindingId: string }; value: { value: string | number }; expected: EditOperationPreconditions; observation?: EditFrameObservation }
  | { schemaVersion: 0; source: string; kind: "set-node-text"; target: { nodeId: string; textBindingId: string }; value: { text: string }; expected: EditOperationPreconditions; observation?: EditFrameObservation }
  | {
      schemaVersion: 0;
      source: string;
      kind: "set-node-transform";
      target: {
        nodeId: string;
        xBindingId: string;
        yBindingId: string;
      };
      value: { x: number; y: number };
      expected: EditOperationPreconditions;
    }
  | {
      schemaVersion: 0;
      source: string;
      kind: "trim-scene-end";
      target: {
        sceneId: string;
        durationBindingId: string;
      };
      mode: "ripple";
      end: {
        space: "global";
        frame: number;
      };
      expected: EditOperationPreconditions;
    }
  | {
      schemaVersion: 0;
      source: string;
      /** Zero-sum rebalance of two adjacent director / layoutTimeline phases. */
      kind: "set-phase-boundary";
      target: {
        sceneId: string;
        leftPhaseName: string;
        rightPhaseName: string;
        leftBindingId: string;
        rightBindingId: string;
      };
      mode: "zero-sum";
      /** New weights in the same unit as the source literals. */
      value: { left: number; right: number };
      unit: "percent" | "seconds";
      expected: EditOperationPreconditions;
    }
  | {
      schemaVersion: 0;
      source: string;
      /** Change one literal still hold in a retained `time()` composition. */
      kind: "set-composition-hold";
      target: {
        /** Qualified selected occurrence path, e.g. `chapter/card`. */
        occurrencePath: string;
        holdBindingId: string;
      };
      /** A positive literal duration accepted by a still occurrence. */
      value: { hold: string };
      expected: EditOperationPreconditions;
    };

// ---------------------------------------------------------------------------
// Transactions / results
// ---------------------------------------------------------------------------

export interface EditTransaction {
  schemaVersion: 0;
  transactionId: string;
  operation: MediaEditCommand;
  state: "committed";
  beforeSourceHashes: Record<string, string>;
  afterSourceHashes: Record<string, string>;
  inverse: MediaEditCommand;
}

export interface EditApplyResult {
  schemaVersion: 0;
  transaction: EditTransaction;
  manifest: EditManifest;
  media: MediaIR;
  diff: MediaIRDiff;
  /** Bounded sample via selectVerificationFrames — not every affected frame. */
  verificationFrames: number[];
  changedPaths: string[];
  diagnostics: Array<{
    code: string;
    message: string;
    bindingId?: string;
  }>;
}
