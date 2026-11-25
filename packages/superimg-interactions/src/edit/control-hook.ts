import { normalizeJson, type JsonObject, type Sha256Digest } from "@foxworth/boundary/program";
import { controlled, type ControlHook } from "@foxworth/boundary/control";
import type { EditApplyResult, MediaEditCommand } from "@superimg/types";
import { NodeEditEngine, type NodeEditPlan } from "./node-engine.js";

export const EDIT_CONTROL_STATE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: [
    "schemaVersion", "command", "beforeMedia", "replacements", "beforeSourceHashes",
    "afterSourceHashes", "beforeIntentHash", "afterIntentHash", "output",
  ],
  properties: {
    schemaVersion: { const: 0 },
    command: { type: "object" },
    beforeMedia: { type: "object" },
    replacements: { type: "array", items: { type: "object" } },
    beforeSourceHashes: { type: "object" },
    afterSourceHashes: { type: "object" },
    beforeIntentHash: { type: "string" },
    afterIntentHash: { type: "string" },
    output: { type: "object" },
  },
} as const;

export const EDIT_CONTROL_PREVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source", "kind", "targetId", "changedPaths", "beforeIntentHash", "afterIntentHash"],
  properties: {
    source: { type: "string", minLength: 1 },
    kind: { enum: ["set-audio-clip-placement", "set-node-property", "set-node-text", "set-node-transform", "trim-scene-end", "set-phase-boundary", "set-composition-hold"] },
    targetId: { type: "string", minLength: 1 },
    changedPaths: { type: "array", items: { type: "string", minLength: 1 } },
    beforeIntentHash: { type: "string", minLength: 1 },
    afterIntentHash: { type: "string", minLength: 1 },
  },
} as const;

export type CreateEditControlHookOptions<Context> = Readonly<{
  engine: NodeEditEngine<Context>;
  realizationDigest: Sha256Digest;
}>;

export function createEditControlHook<Context>(
  options: CreateEditControlHookOptions<Context>,
): ControlHook<
  MediaEditCommand,
  EditApplyResult,
  JsonObject,
  JsonObject,
  typeof EDIT_CONTROL_STATE_SCHEMA,
  typeof EDIT_CONTROL_PREVIEW_SCHEMA,
  Context
> {
  return controlled({
    realizationDigest: options.realizationDigest,
    state: EDIT_CONTROL_STATE_SCHEMA,
    preview: EDIT_CONTROL_PREVIEW_SCHEMA,
    async plan({ input, context }) {
      const plan = await options.engine.plan(input, context);
      const targetId = input.kind === "set-node-transform" || input.kind === "set-node-text" || input.kind === "set-node-property"
        ? input.target.nodeId
        : input.kind === "set-audio-clip-placement" ? input.target.clipId
        : input.kind === "set-composition-hold"
          ? input.target.occurrencePath
          : input.target.sceneId;
      return {
        subject: { kind: "media-source", id: input.source },
        baseline: normalizeJson({
          intentHash: plan.beforeIntentHash,
          sourceHashes: plan.beforeSourceHashes,
        }) as JsonObject,
        baselineSummary: `Media source ${input.source} at ${plan.beforeIntentHash}`,
        effects: [{
          kind: "media-source",
          action: input.kind,
          resource: input.source,
          description: `Edit ${targetId}`,
          details: normalizeJson({
            targetId,
            changedPaths: plan.replacements.map((entry) => entry.relativePath),
          }) as JsonObject,
        }],
        state: normalizeJson(plan) as JsonObject,
        preview: normalizeJson({
          source: input.source,
          kind: input.kind,
          targetId,
          changedPaths: plan.replacements.map((entry) => entry.relativePath),
          beforeIntentHash: plan.beforeIntentHash,
          afterIntentHash: plan.afterIntentHash,
        }) as JsonObject,
      };
    },
    apply({ state, context }) {
      return options.engine.apply(state as unknown as NodeEditPlan, context);
    },
    verify({ state, output, context }) {
      return options.engine.verify(
        state as unknown as NodeEditPlan,
        output,
        context,
      );
    },
    reconcile({ state, context }) {
      return options.engine.reconcile(state as unknown as NodeEditPlan, context);
    },
  });
}
