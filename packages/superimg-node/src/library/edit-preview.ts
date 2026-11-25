//! Native two-sided evidence. Source mutation remains a separate host invocation.
import { compileTemplate } from "@superimg/core";
import { prepareNodeMediaExport } from "../index.js";
import type { MediaEditCommand, ExportableMedia, TemplateBundle, ExactRenderFormat, RuntimeMediaCoordinates, RuntimeRenditionCoordinates, MediaIRDiff, InitOptions, EditFrameObservation } from "@superimg/types";
import type { NodeEditEngine } from "./edit-node-engine.js";

/** Options used to prepare both sides of a source edit preview. */
export interface NodeEditPreviewOptions {
  readonly targets: readonly string[];
  readonly adapter?: {
    readonly fetch?: typeof globalThis.fetch;
    readonly defaultFonts?: InitOptions["defaultFonts"];
    readonly poolStillPages?: boolean;
  };
}

/** One sampled revision. Bytes belong to the caller and are not a publication. */
export interface NodeEditPreviewSample {
  readonly as: ExactRenderFormat;
  readonly mimeType: string;
  readonly coordinates: RuntimeMediaCoordinates;
  readonly bytes: Uint8Array;
  readonly byteLength?: number;
  readonly sha256?: string;
}

export interface NodeEditPreviewRow {
  readonly coordinates: RuntimeRenditionCoordinates;
  readonly frame: number;
  readonly basis: "global-frame";
  readonly before: NodeEditPreviewSample | null;
  readonly after: NodeEditPreviewSample | null;
}

export interface NodeEditPreview {
  readonly report: Readonly<{
    state: "proposed";
    before: { intentHash: string; inputDigest: string };
    after: { intentHash: string; inputDigest: string };
    sourcePatch: { path: string; before: string; after: string }[];
    diff: MediaIRDiff;
    verificationFrames: number[];
    observation?: EditFrameObservation;
  }>;
  compare(frame: number, as?: "html" | "png"): Promise<NodeEditPreviewRow[]>;
  dispose(): Promise<void>;
}

export async function previewNodeEdit<Context>(engine: NodeEditEngine<Context>, command: MediaEditCommand, context: Context, options: NodeEditPreviewOptions): Promise<NodeEditPreview> {
  const plan = await engine.plan(command, context);
  const compile = (bundle: TemplateBundle | undefined, code: string | undefined) => {
    if (!bundle && !code) throw new Error("This edit compiler does not retain executable revision inputs");
    const compiled = compileTemplate(bundle ?? code!);
    if (compiled.error) throw compiled.error;
    if (!compiled.media) throw new Error("Revision is not deterministic media");
    return compiled.media as ExportableMedia;
  };
  const before = await prepareNodeMediaExport(compile(plan.beforeProgramBundle, plan.beforeProgramCode), { for: options.targets, at: 1 }, options.adapter);
  try {
    const after = await prepareNodeMediaExport(compile(plan.afterProgramBundle, plan.afterProgramCode), { for: options.targets, at: 1 }, options.adapter);
    const observation = command.kind === "set-node-text" || command.kind === "set-node-property" ? command.observation : undefined;
    if (observation && !before.matrix.some(row => row.coordinates.entryId === observation.coordinates.entryId && row.coordinates.variantId === observation.coordinates.variantId && row.coordinates.editionId === observation.coordinates.editionId)) {
      await after.dispose();
      throw new Error("Preview does not contain the selected media coordinates");
    }
    let disposed = false;
    const report = Object.freeze({ state: "proposed" as const,
      before: { intentHash: plan.beforeIntentHash, inputDigest: before.digest },
      after: { intentHash: plan.afterIntentHash, inputDigest: after.digest },
      sourcePatch: plan.replacements.map(r => ({ path: r.relativePath, before: r.before, after: r.after })),
      diff: plan.output.diff, verificationFrames: plan.output.verificationFrames, ...(observation ? { observation } : {}),
    });
    return Object.freeze({
      report,
      async compare(frame: number, as: "html" | "png" = "png") {
        if (disposed) throw new Error("Revision preview disposed");
        if (!Number.isSafeInteger(frame) || frame < 0) throw new RangeError("Comparison requires a nonnegative integer global frame");
        if (before.matrix.length !== after.matrix.length) throw new Error("Revision rendition matrix changed");
        const rows: NodeEditPreviewRow[] = [];
        for (const row of before.matrix) {
          // Each revision has its own source digest. Pair logical delivery axes,
          // while retaining each side's exact coordinates for sampling.
          const a = after.matrix.find(r => r.coordinates.entryId === row.coordinates.entryId && r.coordinates.variantId === row.coordinates.variantId && r.coordinates.editionId === row.coordinates.editionId && r.coordinates.renditionId === row.coordinates.renditionId);
          if (!a || a.canvas.width !== row.canvas.width || a.canvas.height !== row.canvas.height || a.clock.fps !== row.clock.fps) throw new Error("Revision canvas/coordinates differ");
          const left = frame >= row.clock.totalFrames ? null : await before.sample(row.coordinates, `${frame}f`, as);
          const right = frame >= a.clock.totalFrames ? null : await after.sample(a.coordinates, `${frame}f`, as);
          rows.push({ coordinates: row.coordinates, frame, basis: "global-frame" as const, before: left, after: right });
        }
        return rows;
      },
      async dispose() { if (disposed) return; try { await before.dispose(); } finally { await after.dispose(); disposed = true; } },
    });
  } catch (e) { await before.dispose(); throw e; }
}
