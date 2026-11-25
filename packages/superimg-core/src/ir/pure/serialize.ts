//! Canonical serialize + hash helpers for MediaIR.

import type { MediaIRHashes, MediaIR } from "@superimg/types";
import type { TemplateBundle } from "@superimg/types";
import { canonicalize, canonicalizeToJson } from "./canonicalize.js";
import { sha256Hex } from "./sha256.js";
import { validateMediaIR } from "./validate.js";

/** Fields that participate in intent (structured timing/motion/assets/config). */
function intentSlice(ir: MediaIR): unknown {
  return {
    kind: ir.kind,
    schemaVersion: ir.schemaVersion,
    identity: ir.identity,
    medium: ir.medium,
    animated: ir.animated,
    canvas: ir.canvas,
    renderConfig: ir.renderConfig,
    clock: ir.clock,
    capabilities: {
      temporal: ir.capabilities.temporal,
      motion: ir.capabilities.motion,
      visual: ir.capabilities.visual,
      portability: ir.capabilities.portability,
      // exclude issues/determinism from intent stability where useful — keep determinism out
    },
    scenes: ir.scenes,
    tracks: ir.tracks,
    motions: ir.motions,
    assets: ir.assets.map((a) => {
      const o: Record<string, unknown> = {
        id: a.id,
        kind: a.kind,
        src: a.src,
        remote: a.remote,
      };
      if (a.contentHash !== undefined) o.contentHash = a.contentHash;
      return o;
    }),
    extensions: ir.extensions,
  };
}

function markupSlice(ir: MediaIR): unknown {
  return ir.observations;
}

export function computeMediaIRHashes(
  ir: Omit<MediaIR, "hashes"> & { hashes?: MediaIRHashes },
  programHash: string,
): MediaIRHashes {
  const intentHash = sha256Hex(canonicalizeToJson(intentSlice(ir as MediaIR)));
  const markupHash = sha256Hex(canonicalizeToJson(markupSlice(ir as MediaIR)));
  return {
    intentHash,
    markupHash,
    programHash,
  };
}

/** Canonical JSON string (sorted keys). Does not recompute hashes. */
export function serializeMediaIR(ir: MediaIR): string {
  const validated = validateMediaIR(ir);
  return canonicalizeToJson(validated);
}

/** Pretty canonical form for fixtures (stable key order via canonicalize). */
export function serializeMediaIRPretty(ir: MediaIR): string {
  const validated = validateMediaIR(ir);
  return `${JSON.stringify(canonicalize(validated), null, 2)}\n`;
}

export function hashBytes(data: string | Uint8Array): string {
  return sha256Hex(data);
}

/** Identity of every emitted filename, byte payload and source map. */
export function hashTemplateOutputs(outputs: NonNullable<TemplateBundle["outputs"]>): string {
  const records = outputs.map(item => item.type === "chunk"
    ? [item.type, item.fileName, item.isEntry, hashBytes(item.code), hashBytes(JSON.stringify(item.sourceMap))]
    : [item.type, item.fileName, hashBytes(item.source)]).sort((a, b) => String(a[1]) < String(b[1]) ? -1 : String(a[1]) > String(b[1]) ? 1 : 0);
  return hashBytes(JSON.stringify(records));
}
