import { createHash } from "node:crypto";
import { render } from "@superimg/core/runtime";
import {
  compileNodeMediaSource,
  findScriptSources,
  fitPngWidth,
  loadNodeMediaValue,
  pngSize,
  MediaScriptError,
  readScriptCues,
  type NodeMediaAuthoringOptions,
} from "@superimg/node/source";
import { normalizeProjectRoot, resolveMediaSource } from "@superimg/node/project";
import type { ExportableMedia, Runtime } from "@superimg/types";
import { bytesToBase64 } from "../rasters.js";
import {
  SCRIPT_INTERACTION_IDS,
  ScriptInteractionError,
  type ScriptInteractionErrorCode,
  type ScriptInteractionHandlers,
} from "./contracts.js";
import { createScriptInteractionMount, type ScriptInteractionMount } from "./mount.js";

export type CreateNodeScriptInteractionMountOptions = Pick<
  NodeMediaAuthoringOptions,
  "sourceAnalysis" | "authoringFacades"
> & Readonly<{
  /** Nothing outside this directory is read to answer `media.script.sources`. */
  projectRoot: string;
  /**
   * Host-owned runtime, used only by `media.script.still`. The mount never
   * disposes it. Without one, sources and cues work and a still is refused.
   */
  runtime?: Runtime;
}>;

const DECLARED = new Set<string>([
  "INVALID_INPUT", "SCRIPT_NOT_FOUND", "SCRIPT_OUTSIDE_ROOT", "NOT_A_SCRIPT", "NO_SCRIPT",
  "MULTIPLE_SCRIPTS", "UNSUPPORTED_SOURCE", "COLLECTION_PROVIDER_DEFERRED", "EMPTY_COLLECTION",
  "UNKNOWN_ENTRY", "INVALID_CUE", "BLOCK_NOT_PLACED",
]);

/** Library refusals keep their code at the boundary. Anything else stays the host's own error. */
async function declared<T>(interactionId: string, work: () => Promise<T> | T): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof MediaScriptError && DECLARED.has(cause.code)) {
      throw new ScriptInteractionError(
        cause.code as ScriptInteractionErrorCode,
        `${interactionId}.input`,
        cause.message,
        { cause },
      );
    }
    throw cause;
  }
}

/**
 * Mount the script Program on a Node host. All three interactions read and
 * change nothing. `sources` runs no film code; `cues` compiles the film and
 * runs its `resolve()`; `still` also renders one frame.
 */
export function createNodeScriptInteractionMount<Context>(
  options: CreateNodeScriptInteractionMountOptions,
): ScriptInteractionMount<Context> {
  const projectRoot = normalizeProjectRoot(options.projectRoot);
  const authoring = {
    ...(options.sourceAnalysis === undefined ? {} : { sourceAnalysis: options.sourceAnalysis }),
    ...(options.authoringFacades === undefined ? {} : { authoringFacades: options.authoringFacades }),
  };
  const handlers: ScriptInteractionHandlers<Context> = {
    sources({ input }) {
      return declared(SCRIPT_INTERACTION_IDS.sources, () => findScriptSources(projectRoot, input.script));
    },
    cues({ input }) {
      return declared(SCRIPT_INTERACTION_IDS.cues, () =>
        readScriptCues(projectRoot, input.source, {
          ...authoring,
          ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
        }),
      );
    },
    still({ input }) {
      return declared(SCRIPT_INTERACTION_IDS.still, async () => {
        if (!options.runtime) {
          throw new ScriptInteractionError(
            "INVALID_INPUT",
            `${SCRIPT_INTERACTION_IDS.still}.input`,
            "This host has not configured a runtime for stills",
          );
        }
        const source = resolveMediaSource(projectRoot, input.source);
        // One compilation serves the cue and the frame, so the hashes describe the still.
        const preparedSource = await compileNodeMediaSource(projectRoot, source, authoring);
        const cues = await readScriptCues(projectRoot, source, {
          ...authoring,
          preparedSource,
          ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
        });
        const cue = cues.cues.find((item) => item.blockId === input.blockId);
        if (!cue) {
          throw new ScriptInteractionError(
            "BLOCK_NOT_PLACED",
            `${SCRIPT_INTERACTION_IDS.still}.input.blockId`,
            `${cues.relativePath} publishes no cue for block ${JSON.stringify(input.blockId)}`,
          );
        }
        const totalFrames = Math.max(1, Math.round(cues.durationSeconds * cues.fps));
        const frame = Math.min(totalFrames - 1, Math.max(0, Math.round(cue.stillSeconds * cues.fps)));
        const loaded = await loadNodeMediaValue(projectRoot, source, { ...authoring, preparedSource });
        const rendered = await render(options.runtime, loaded.value as ExportableMedia, {
          as: "png",
          at: `${frame}f`,
          providers: "skip",
          ...(cues.entryId === undefined ? {} : { entryId: cues.entryId }),
        });
        const bytes = await fitPngWidth(await rendered.bytes(), input.maxWidth);
        return Object.freeze({
          schemaVersion: 0 as const,
          kind: "media-script-still" as const,
          sourceId: cues.sourceId,
          relativePath: cues.relativePath,
          programHash: cues.programHash,
          scriptHash: cues.scriptHash,
          blockId: cue.blockId,
          atSeconds: Math.round((frame / cues.fps) * 1e6) / 1e6,
          frame,
          mimeType: "image/png" as const,
          bytes: bytesToBase64(bytes),
          ...pngSize(bytes),
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      });
    },
  };
  return createScriptInteractionMount({ handlers });
}
