import type { JsonObject, JsonValue } from "@foxworth/boundary/program";
import type {
  EditApplyResult,
  EditManifest,
  MediaEditCommand,
} from "@superimg/types";

export const EDIT_INTERACTION_IDS = Object.freeze({
  bindings: "media.edit.bindings",
  setNodeText: "media.edit.set-node-text",
  setNodeProperty: "media.edit.set-node-property",
  setAudioClipPlacement: "media.edit.set-audio-clip-placement",
  setNodeTransform: "media.edit.set-node-transform",
  trimSceneEnd: "media.edit.trim-scene-end",
  setPhaseBoundary: "media.edit.set-phase-boundary",
  setCompositionHold: "media.edit.set-composition-hold",
} as const);

export type EditInteractionId =
  (typeof EDIT_INTERACTION_IDS)[keyof typeof EDIT_INTERACTION_IDS];
export type ControlledEditInteractionId = Exclude<
  EditInteractionId,
  typeof EDIT_INTERACTION_IDS.bindings
>;

export type EditBindingsInteractionInput = Readonly<{ source: string }>;
export type EditBindingsInteractionOutput = Readonly<{
  schemaVersion: 0;
  kind: "media-edit-bindings";
  source: string;
  sourceId: string;
  manifest: EditManifest;
  sourceHashes: Readonly<Record<string, string>>;
}>;

export type SetAudioClipPlacementInteractionInput = Extract<MediaEditCommand, { kind: "set-audio-clip-placement" }>;
export type SetNodePropertyInteractionInput = Extract<MediaEditCommand, { kind: "set-node-property" }>;
export type SetNodeTextInteractionInput = Extract<MediaEditCommand, { kind: "set-node-text" }>;
export type SetNodeTransformInteractionInput = Extract<
  MediaEditCommand,
  { kind: "set-node-transform" }
>;
export type TrimSceneEndInteractionInput = Extract<
  MediaEditCommand,
  { kind: "trim-scene-end" }
>;
export type SetPhaseBoundaryInteractionInput = Extract<
  MediaEditCommand,
  { kind: "set-phase-boundary" }
>;
export type SetCompositionHoldInteractionInput = Extract<
  MediaEditCommand,
  { kind: "set-composition-hold" }
>;

export interface EditInteractionInputById {
  readonly "media.edit.bindings": EditBindingsInteractionInput;
  readonly "media.edit.set-node-text": SetNodeTextInteractionInput;
  readonly "media.edit.set-node-property": SetNodePropertyInteractionInput;
  readonly "media.edit.set-audio-clip-placement": SetAudioClipPlacementInteractionInput;
  readonly "media.edit.set-node-transform": SetNodeTransformInteractionInput;
  readonly "media.edit.trim-scene-end": TrimSceneEndInteractionInput;
  readonly "media.edit.set-phase-boundary": SetPhaseBoundaryInteractionInput;
  readonly "media.edit.set-composition-hold": SetCompositionHoldInteractionInput;
}

export interface EditInteractionOutputById {
  readonly "media.edit.bindings": EditBindingsInteractionOutput;
  readonly "media.edit.set-node-text": EditApplyResult;
  readonly "media.edit.set-node-property": EditApplyResult;
  readonly "media.edit.set-audio-clip-placement": EditApplyResult;
  readonly "media.edit.set-node-transform": EditApplyResult;
  readonly "media.edit.trim-scene-end": EditApplyResult;
  readonly "media.edit.set-phase-boundary": EditApplyResult;
  readonly "media.edit.set-composition-hold": EditApplyResult;
}

export type EditInteractionRequestFor<Id extends EditInteractionId> = Readonly<{
  interactionId: Id;
  input: EditInteractionInputById[Id];
}>;

export interface EditInteractionHandlers<Context> {
  bindings(args: Readonly<{
    input: EditBindingsInteractionInput;
    context: Context;
  }>): Promise<EditBindingsInteractionOutput> | EditBindingsInteractionOutput;
  setAudioClipPlacement(args: Readonly<{ input: SetAudioClipPlacementInteractionInput; context: Context }>): Promise<EditApplyResult> | EditApplyResult;
  setNodeProperty(args: Readonly<{ input: SetNodePropertyInteractionInput; context: Context }>): Promise<EditApplyResult> | EditApplyResult;
  setNodeText(args: Readonly<{ input: SetNodeTextInteractionInput; context: Context }>): Promise<EditApplyResult> | EditApplyResult;
  setNodeTransform(args: Readonly<{
    input: SetNodeTransformInteractionInput;
    context: Context;
  }>): Promise<EditApplyResult> | EditApplyResult;
  trimSceneEnd(args: Readonly<{
    input: TrimSceneEndInteractionInput;
    context: Context;
  }>): Promise<EditApplyResult> | EditApplyResult;
  setPhaseBoundary(args: Readonly<{
    input: SetPhaseBoundaryInteractionInput;
    context: Context;
  }>): Promise<EditApplyResult> | EditApplyResult;
  setCompositionHold(args: Readonly<{
    input: SetCompositionHoldInteractionInput;
    context: Context;
  }>): Promise<EditApplyResult> | EditApplyResult;
}

export { EditInteractionError, EditInteractionUncertainError, type EditInteractionErrorCode } from "@superimg/node/edit-errors";
import type { EditInteractionErrorCode } from "@superimg/node/edit-errors";

export type EditInteractionDeclaredErrorCode = EditInteractionErrorCode |
  "CANCELLED" | "INTERACTION_FAILED";

export type EditInteractionDeclaredError = JsonObject & Readonly<{
  schemaVersion: 1;
  kind: "media-edit-interaction-error";
  code: EditInteractionDeclaredErrorCode;
  path: string;
  message: string;
}>;

export type EditJsonValue = JsonValue;
