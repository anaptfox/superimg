//! Script interactions: read-only questions an editor asks about a script file
//! and the films that read it. A separate Program from `media`, so adding it
//! leaves every existing media contract and its identity untouched.

import type { JsonObject } from "@foxworth/boundary/program";
import type {
  MediaScriptCues,
  MediaScriptSources,
} from "@superimg/node/source";

export type { MediaScriptCue, MediaScriptCueFinding, MediaScriptCues, MediaScriptSource, MediaScriptSources } from "@superimg/node/source";

export const SCRIPT_INTERACTION_IDS = Object.freeze({
  sources: "media.script.sources",
  cues: "media.script.cues",
  still: "media.script.still",
} as const);

export type ScriptInteractionId =
  (typeof SCRIPT_INTERACTION_IDS)[keyof typeof SCRIPT_INTERACTION_IDS];

export type ScriptSourcesInteractionInput = Readonly<{
  /** Project-relative path of a `*.script.md` file. */
  script: string;
}>;

export type ScriptCuesInteractionInput = Readonly<{
  /** Project-relative path, source id, or unambiguous short name. */
  source: string;
  /** Optional static collection entry id when `source` exports a `collection()`. */
  entryId?: string;
}>;

export type ScriptStillInteractionInput = Readonly<{
  source: string;
  /** The script block to show. The film chooses the moment. */
  blockId: string;
  /** Optional static collection entry id when `source` exports a `collection()`. */
  entryId?: string;
  /** Scale a wider frame down to this many pixels. */
  maxWidth?: number;
}>;

export type MediaScriptStill = Readonly<{
  schemaVersion: 0;
  kind: "media-script-still";
  sourceId: string;
  relativePath: string;
  programHash: string;
  scriptHash: string;
  blockId: string;
  atSeconds: number;
  frame: number;
  mimeType: "image/png";
  /** Base64. The caller decodes; SuperImg writes nothing. */
  bytes: string;
  width: number;
  height: number;
  sha256: string;
}>;

export interface ScriptInteractionInputById {
  readonly "media.script.sources": ScriptSourcesInteractionInput;
  readonly "media.script.cues": ScriptCuesInteractionInput;
  readonly "media.script.still": ScriptStillInteractionInput;
}

export interface ScriptInteractionOutputById {
  readonly "media.script.sources": MediaScriptSources;
  readonly "media.script.cues": MediaScriptCues;
  readonly "media.script.still": MediaScriptStill;
}

export type ScriptInteractionRequestFor<Id extends ScriptInteractionId> = Readonly<{
  interactionId: Id;
  input: ScriptInteractionInputById[Id];
}>;

type Handler<Input, Output, Context> = (
  args: Readonly<{ input: Input; context: Context }>,
) => Promise<Output> | Output;

export interface ScriptInteractionHandlers<Context> {
  sources: Handler<ScriptSourcesInteractionInput, MediaScriptSources, Context>;
  cues: Handler<ScriptCuesInteractionInput, MediaScriptCues, Context>;
  still: Handler<ScriptStillInteractionInput, MediaScriptStill, Context>;
}

export type ScriptInteractionErrorCode =
  | "UNKNOWN_INTERACTION"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "SCRIPT_NOT_FOUND"
  | "SCRIPT_OUTSIDE_ROOT"
  | "NOT_A_SCRIPT"
  | "NO_SCRIPT"
  | "MULTIPLE_SCRIPTS"
  | "UNSUPPORTED_SOURCE"
  | "COLLECTION_PROVIDER_DEFERRED"
  | "EMPTY_COLLECTION"
  | "UNKNOWN_ENTRY"
  | "INVALID_CUE"
  | "BLOCK_NOT_PLACED";

export type ScriptInteractionDeclaredError = JsonObject & Readonly<{
  schemaVersion: 1;
  kind: "media-script-interaction-error";
  code: ScriptInteractionErrorCode;
  path: string;
  message: string;
}>;

export class ScriptInteractionError extends Error {
  /** Every script interaction only reads, so a refusal is a finished answer. */
  readonly certainty = "completed";
  readonly certaintyScope = "command";
  readonly issues: readonly Readonly<{ path: string; message: string }>[] | undefined;

  constructor(
    readonly code: ScriptInteractionErrorCode,
    readonly path: string,
    message: string,
    options: Readonly<{
      cause?: unknown;
      issues?: readonly Readonly<{ path: string; message: string }>[];
    }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ScriptInteractionError";
    this.issues = options.issues;
  }
}
