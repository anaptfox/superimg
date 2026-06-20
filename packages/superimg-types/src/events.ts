//! Typed, versioned event contract for superimg build integrations.
//! Both JS consumers (render wrappers) and Rust deserializers (e.g. gumbo)
//! should key on the `v` field before reading event-specific fields.
//! Bump `v` on any breaking field rename or removal; additive fields are non-breaking.

import type { OutputFormat } from "./encoding-types.js";

export const RENDER_EVENT_VERSION = 1 as const;

export type RenderEvent =
  | {
      v: 1;
      event: "start";
      name: string;
      entrypoint: string;
      format: OutputFormat;
    }
  | {
      v: 1;
      event: "progress";
      name: string;
      frame: number;
      totalFrames: number;
    }
  | {
      v: 1;
      event: "done";
      name: string;
      outputPath: string;
      format: OutputFormat;
      durationMs: number;
    }
  | {
      v: 1;
      event: "skipped";
      name: string;
      format: OutputFormat;
      /** Human-readable reason (e.g. "fingerprint unchanged"). */
      reason: string;
      /** Opaque key the caller used to decide staleness — surfaced for debugging. */
      fingerprint?: string;
    }
  | {
      v: 1;
      event: "error";
      name: string;
      /** May be absent when the error occurs before format is known. */
      format?: OutputFormat;
      message: string;
      code?: string;
    }
  | {
      v: 1;
      event: "summary";
      rendered: number;
      skipped: number;
      failed: number;
      /** Per-format counts for rendered outputs. */
      byFormat: Partial<Record<OutputFormat, number>>;
    };
