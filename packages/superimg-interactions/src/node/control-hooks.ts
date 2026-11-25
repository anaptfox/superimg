import { createHash } from "node:crypto";
import { existsSync, lstatSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readMediaArtifact } from "@superimg/core/ir-node";
import { ORGANIC_DESTINATIONS } from "@superimg/core/destinations";
import {
  controlled,
  type ControlHook,
} from "@foxworth/boundary/control";
import {
  normalizeJson,
  type JsonObject,
  type Sha256Digest,
} from "@foxworth/boundary/program";
import {
  MEDIA_INTERACTION_IDS,
  type MediaArtifactCompileInteractionInput,
  type MediaArtifactCompileReceipt,
  type MediaCollectionSnapshot,
  type MediaCollectionSnapshotInteractionInput,
  type MediaExportInteractionInput,
  type MediaExportReceipt,
  type MediaJsonObject,
} from "../contracts.js";
import type { MediaDirectDispatcher } from "../mount.js";
import {
  normalizeProjectRoot,
  readMediaSource,
  resolveMediaSource,
} from "./discovery.js";
import {
  assertSnapshotCurrent,
  hashJson,
  providerDigest,
} from "./provider.js";
import {
  compileNodeMediaSource,
  type NodeMediaAuthoringOptions,
} from "./source.js";
import {
  resolveMediaTargetPath,
  type MediaLogicalTargetKind,
  type MediaTargetRegistry,
} from "./targets.js";

const SHA256 = { type: "string", pattern: "^[a-f0-9]{64}$" } as const;
const NULLABLE_SHA256 = { anyOf: [SHA256, { type: "null" }] } as const;

export const NODE_MEDIA_CONTROL_STATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "interactionId",
    "input",
    "source",
    "target",
    "baseline",
  ],
  properties: {
    schemaVersion: { const: 0 },
    interactionId: {
      enum: [
        MEDIA_INTERACTION_IDS.snapshot,
        MEDIA_INTERACTION_IDS.compile,
        MEDIA_INTERACTION_IDS.export,
      ],
    },
    input: { type: "object" },
    source: {
      type: "object",
      additionalProperties: false,
      required: [
        "sourceId",
        "relativePath",
        "kind",
        "sourceDigest",
        "programDigest",
        "providerDigest",
      ],
      properties: {
        sourceId: { type: "string", minLength: 1 },
        relativePath: { type: "string", minLength: 1 },
        kind: { enum: ["media", "interactive", "static-collection", "provider-collection"] },
        sourceDigest: SHA256,
        programDigest: SHA256,
        providerDigest: NULLABLE_SHA256,
      },
    },
    target: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "targetId", "logicalId", "registryDigest"],
          properties: {
            kind: { enum: ["artifact", "publication"] },
            targetId: { type: "string", minLength: 1 },
            logicalId: { type: "string", minLength: 1 },
            registryDigest: SHA256,
          },
        },
      ],
    },
    baseline: {
      type: "object",
      additionalProperties: false,
      required: ["status", "digest"],
      properties: {
        status: { enum: ["missing", "committed", "unknown"] },
        digest: NULLABLE_SHA256,
      },
    },
  },
} as const;

export const NODE_MEDIA_CONTROL_PREVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["interactionId", "sourceId", "sourceDigest", "target"],
  properties: {
    interactionId: {
      enum: [
        MEDIA_INTERACTION_IDS.snapshot,
        MEDIA_INTERACTION_IDS.compile,
        MEDIA_INTERACTION_IDS.export,
      ],
    },
    sourceId: { type: "string", minLength: 1 },
    sourceDigest: SHA256,
    target: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "targetId", "logicalId"],
          properties: {
            kind: { enum: ["artifact", "publication"] },
            targetId: { type: "string", minLength: 1 },
            logicalId: { type: "string", minLength: 1 },
          },
        },
      ],
    },
  },
} as const;

type ControlledInteractionId =
  | typeof MEDIA_INTERACTION_IDS.snapshot
  | typeof MEDIA_INTERACTION_IDS.compile
  | typeof MEDIA_INTERACTION_IDS.export;

type ControlledInput =
  | MediaCollectionSnapshotInteractionInput
  | MediaArtifactCompileInteractionInput
  | MediaExportInteractionInput;

type SourceState = Readonly<{
  sourceId: string;
  relativePath: string;
  kind: "media" | "interactive" | "static-collection" | "provider-collection";
  sourceDigest: string;
  programDigest: string;
  providerDigest: string | null;
}>;

type TargetState = Readonly<{
  kind: MediaLogicalTargetKind;
  targetId: string;
  logicalId: string;
  registryDigest: string;
}>;

type BaselineState = Readonly<{
  status: "missing" | "committed" | "unknown";
  digest: string | null;
}>;

export type NodeMediaControlState<Input extends ControlledInput = ControlledInput> =
  JsonObject & Readonly<{
    schemaVersion: 0;
    interactionId: ControlledInteractionId;
    input: Input;
    source: SourceState;
    target: TargetState | null;
    baseline: BaselineState;
  }>;

export type NodeMediaControlPreview = JsonObject & Readonly<{
  interactionId: ControlledInteractionId;
  sourceId: string;
  sourceDigest: string;
  target: Omit<TargetState, "registryDigest"> | null;
}>;

export type CreateNodeMediaControlHookOptions<Context> = NodeMediaAuthoringOptions & Readonly<{
  projectRoot: string;
  dispatch: MediaDirectDispatcher<Context>;
  targets: MediaTargetRegistry<Context>;
  realizationDigest: Sha256Digest;
}>;

export type CreateNodeMediaControlHooksOptions<Context> = Omit<
  CreateNodeMediaControlHookOptions<Context>,
  "realizationDigest"
> & Readonly<{
  realizationDigests: Readonly<{
    snapshot: Sha256Digest;
    compile: Sha256Digest;
    export: Sha256Digest;
  }>;
}>;

export function createNodeMediaControlHooks<Context>(
  options: CreateNodeMediaControlHooksOptions<Context>,
) {
  const shared = {
    projectRoot: options.projectRoot,
    dispatch: options.dispatch,
    targets: options.targets,
    ...(options.sourceAnalysis === undefined
      ? {}
      : { sourceAnalysis: options.sourceAnalysis }),
    ...(options.authoringFacades === undefined
      ? {}
      : { authoringFacades: options.authoringFacades }),
  };
  return Object.freeze({
    snapshot: createMediaSnapshotControlHook({
      ...shared,
      realizationDigest: options.realizationDigests.snapshot,
    }),
    compile: createMediaArtifactCompileControlHook({
      ...shared,
      realizationDigest: options.realizationDigests.compile,
    }),
    export: createMediaExportControlHook({
      ...shared,
      realizationDigest: options.realizationDigests.export,
    }),
  });
}

export function createMediaSnapshotControlHook<Context>(
  options: CreateNodeMediaControlHookOptions<Context>,
): ControlHook<
  MediaCollectionSnapshotInteractionInput,
  MediaCollectionSnapshot,
  NodeMediaControlState<MediaCollectionSnapshotInteractionInput>,
  NodeMediaControlPreview,
  typeof NODE_MEDIA_CONTROL_STATE_SCHEMA,
  typeof NODE_MEDIA_CONTROL_PREVIEW_SCHEMA,
  Context
> {
  const root = normalizeProjectRoot(options.projectRoot);
  return controlled({
    realizationDigest: options.realizationDigest,
    state: NODE_MEDIA_CONTROL_STATE_SCHEMA,
    preview: NODE_MEDIA_CONTROL_PREVIEW_SCHEMA,
    async plan({ input, context }) {
      const state = await prepareState(root, MEDIA_INTERACTION_IDS.snapshot, input, context, options.targets, options);
      if (!state.source.kind.endsWith("collection")) {
        throw new Error("Collection snapshot control requires a collection source");
      }
      return planFor(state, "snapshot", `Snapshot collection ${state.source.sourceId}`);
    },
    async apply({ state, context }) {
      await assertCurrent(root, state, context, options.targets, options);
      return options.dispatch({ interactionId: MEDIA_INTERACTION_IDS.snapshot, input: state.input }, context);
    },
    async verify({ state, output, context }) {
      try {
        const current = await assertCurrent(root, state, context, options.targets, options);
        assertSnapshotCurrent(output, current.loaded.descriptor as never, current.resolved, root);
        return {
          ok: true,
          evidence: {
            sourceDigest: state.source.sourceDigest,
            providerDigest: output.providerHash,
            snapshotDigest: output.snapshotDigest,
          },
        };
      } catch (cause) {
        return { ok: false, message: message(cause) };
      }
    },
    async reconcile({ state, context }) {
      try {
        await assertCurrent(root, state, context, options.targets, options);
        if (state.source.kind === "provider-collection") return { status: "uncertain" } as const;
        const value = await options.dispatch(
          { interactionId: MEDIA_INTERACTION_IDS.snapshot, input: state.input },
          context,
        );
        return { status: "completed", value } as const;
      } catch {
        return { status: "uncertain" } as const;
      }
    },
  });
}

export function createMediaArtifactCompileControlHook<Context>(
  options: CreateNodeMediaControlHookOptions<Context>,
): ControlHook<
  MediaArtifactCompileInteractionInput,
  MediaArtifactCompileReceipt,
  NodeMediaControlState<MediaArtifactCompileInteractionInput>,
  NodeMediaControlPreview,
  typeof NODE_MEDIA_CONTROL_STATE_SCHEMA,
  typeof NODE_MEDIA_CONTROL_PREVIEW_SCHEMA,
  Context
> {
  const root = normalizeProjectRoot(options.projectRoot);
  return controlled({
    realizationDigest: options.realizationDigest,
    state: NODE_MEDIA_CONTROL_STATE_SCHEMA,
    preview: NODE_MEDIA_CONTROL_PREVIEW_SCHEMA,
    async plan({ input, context }) {
      const state = await prepareState(root, MEDIA_INTERACTION_IDS.compile, input, context, options.targets, options);
      requireFrozenProvider(state, input.snapshot);
      return planFor(state, "write", `Compile artifact ${input.target.artifactId}`);
    },
    async apply({ state, context }) {
      await assertCurrent(root, state, context, options.targets, options);
      const output = await options.dispatch(
        { interactionId: MEDIA_INTERACTION_IDS.compile, input: state.input },
        context,
      );
      const inspection = await inspectControlledTarget(root, state, context, options.targets);
      if (
        inspection.status !== "committed" ||
        inspection.kind !== "artifact" ||
        hashJson(withArtifactIdentity(inspection.receipt, state)) !== hashJson(output)
      ) {
        throw new Error("Compiled artifact bytes do not match the returned receipt");
      }
      return output;
    },
    async verify({ state, output, context }) {
      try {
        await assertCurrent(root, state, context, options.targets, options);
        const inspection = await inspectControlledTarget(root, state, context, options.targets);
        if (
          inspection.status !== "committed" || inspection.kind !== "artifact" ||
          hashJson(withArtifactIdentity(inspection.receipt, state)) !== hashJson(output) ||
          !artifactMatchesState(inspection.receipt, state)
        ) {
          return { ok: false, message: "committed artifact does not match the planned receipt" };
        }
        return { ok: true, evidence: { artifactHash: output.artifactHash } };
      } catch (cause) {
        return { ok: false, message: message(cause) };
      }
    },
    reconcile(args) {
      return reconcileArtifactTarget(root, args.state, args.context, options.targets, options);
    },
  });
}

export function createMediaExportControlHook<Context>(
  options: CreateNodeMediaControlHookOptions<Context>,
): ControlHook<
  MediaExportInteractionInput,
  MediaExportReceipt,
  NodeMediaControlState<MediaExportInteractionInput>,
  NodeMediaControlPreview,
  typeof NODE_MEDIA_CONTROL_STATE_SCHEMA,
  typeof NODE_MEDIA_CONTROL_PREVIEW_SCHEMA,
  Context
> {
  const root = normalizeProjectRoot(options.projectRoot);
  return controlled({
    realizationDigest: options.realizationDigest,
    state: NODE_MEDIA_CONTROL_STATE_SCHEMA,
    preview: NODE_MEDIA_CONTROL_PREVIEW_SCHEMA,
    async plan({ input, context }) {
      const state = await prepareState(root, MEDIA_INTERACTION_IDS.export, input, context, options.targets, options);
      requireFrozenProvider(state, input.snapshot);
      return planFor(state, "write", `Publish media ${input.publication.publicationId}`);
    },
    async apply({ state, context }) {
      await assertCurrent(root, state, context, options.targets, options);
      const output = await options.dispatch(
        { interactionId: MEDIA_INTERACTION_IDS.export, input: state.input },
        context,
      );
      const inspection = await inspectControlledTarget(root, state, context, options.targets);
      if (
        inspection.status !== "committed" || inspection.kind !== "publication" ||
        hashJson(withPublicationIdentity(inspection.receipt, state)) !== hashJson(output)
      ) {
        throw new Error("Published media bytes do not match the returned receipt");
      }
      return output;
    },
    async verify({ state, output, context }) {
      try {
        await assertCurrent(root, state, context, options.targets, options);
        const inspection = await inspectControlledTarget(root, state, context, options.targets);
        if (
          inspection.status !== "committed" || inspection.kind !== "publication" ||
          hashJson(withPublicationIdentity(inspection.receipt, state)) !== hashJson(output) ||
          !publicationMatchesState(inspection.receipt, state)
        ) {
          return { ok: false, message: "committed publication does not match the planned receipt" };
        }
        return { ok: true, evidence: { manifestDigest: output.manifestDigest } };
      } catch (cause) {
        return { ok: false, message: message(cause) };
      }
    },
    reconcile(args) {
      return reconcilePublicationTarget(root, args.state, args.context, options.targets, options);
    },
  });
}

async function prepareState<Context, Input extends ControlledInput>(
  root: string,
  interactionId: ControlledInteractionId,
  input: Input,
  context: Context,
  targets: MediaTargetRegistry<Context>,
  authoring: NodeMediaAuthoringOptions,
): Promise<NodeMediaControlState<Input>> {
  const resolved = resolveMediaSource(root, input.source);
  const sourceBytes = readMediaSource(resolved);
  const loaded = await compileNodeMediaSource(root, resolved, {
    ...(authoring.sourceAnalysis === undefined
      ? {}
      : { sourceAnalysis: authoring.sourceAnalysis }),
    ...(authoring.authoringFacades === undefined
      ? {}
      : { authoringFacades: authoring.authoringFacades }),
  });
  const collection = loaded.descriptor.kind === "collection";
  const provider = collection && loaded.descriptor.entries.kind === "provider";
  const source: SourceState = Object.freeze({
    sourceId: resolved.sourceId,
    relativePath: resolved.relativePath,
    kind: loaded.compiled.interactive
      ? "interactive"
      : collection
        ? provider ? "provider-collection" : "static-collection"
        : "media",
    sourceDigest: sha256(sourceBytes),
    programDigest: sha256(loaded.bundle.code),
    providerDigest: collection ? providerDigest(loaded.descriptor, root) : null,
  });
  if (provider && "snapshot" in input && input.snapshot !== undefined) {
    assertSnapshotCurrent(input.snapshot, loaded.descriptor, resolved, root);
  }

  const selected = targetFor(interactionId, input);
  let target: TargetState | null = null;
  let baseline: BaselineState = Object.freeze({ status: "missing", digest: null });
  if (selected !== null) {
    const resolution = await targets.resolve({
      kind: selected.kind,
      targetId: selected.targetId,
      context,
    });
    resolveMediaTargetPath(resolution, selected.logicalId);
    target = Object.freeze({
      ...selected,
      registryDigest: resolution.registryDigest,
    });
    baseline = await inspectBaseline(resolution.rootPath, selected.logicalId, selected.kind);
  }
  return normalizeJson({
    schemaVersion: 0,
    interactionId,
    input,
    source,
    target,
    baseline,
  }) as NodeMediaControlState<Input>;
}

function planFor<Input extends ControlledInput>(
  state: NodeMediaControlState<Input>,
  action: string,
  description: string,
) {
  const preview = normalizeJson({
    interactionId: state.interactionId,
    sourceId: state.source.sourceId,
    sourceDigest: state.source.sourceDigest,
    target: state.target === null
      ? null
      : {
          kind: state.target.kind,
          targetId: state.target.targetId,
          logicalId: state.target.logicalId,
        },
  }) as NodeMediaControlPreview;
  return {
    subject: {
      kind: state.target?.kind ?? "media-collection",
      id: state.target?.logicalId ?? state.source.sourceId,
    },
    baseline: normalizeJson({
      sourceDigest: state.source.sourceDigest,
      programDigest: state.source.programDigest,
      providerDigest: state.source.providerDigest,
      registryDigest: state.target?.registryDigest ?? null,
      targetStatus: state.baseline.status,
      targetDigest: state.baseline.digest,
    }) as JsonObject,
    baselineSummary: `${state.source.sourceId} at ${state.source.sourceDigest.slice(0, 12)}`,
    effects: [{
      kind: state.target?.kind ?? "media-collection",
      action,
      resource: state.target?.logicalId ?? state.source.sourceId,
      description,
      details: normalizeJson({
        targetId: state.target?.targetId ?? null,
        logicalId: state.target?.logicalId ?? null,
      }) as JsonObject,
    }],
    state,
    preview,
  };
}

async function assertCurrent<Context, Input extends ControlledInput>(
  root: string,
  state: NodeMediaControlState<Input>,
  context: Context,
  targets: MediaTargetRegistry<Context>,
  authoring: NodeMediaAuthoringOptions,
) {
  const current = await prepareSource(root, state.input.source, authoring);
  if (
    current.source.sourceId !== state.source.sourceId ||
    current.source.relativePath !== state.source.relativePath ||
    current.source.kind !== state.source.kind ||
    current.source.sourceDigest !== state.source.sourceDigest ||
    current.source.programDigest !== state.source.programDigest ||
    current.source.providerDigest !== state.source.providerDigest
  ) {
    throw new Error("Media source or provider changed after control planning");
  }
  if (state.target !== null) {
    const resolution = await targets.resolve({
      kind: state.target.kind,
      targetId: state.target.targetId,
      context,
    });
    resolveMediaTargetPath(resolution, state.target.logicalId);
    if (resolution.registryDigest !== state.target.registryDigest) {
      throw new Error("Media target registry changed after control planning");
    }
  }
  return current;
}

async function prepareSource(
  root: string,
  requested: string,
  authoring: NodeMediaAuthoringOptions,
) {
  const resolved = resolveMediaSource(root, requested);
  const loaded = await compileNodeMediaSource(root, resolved, {
    ...(authoring.sourceAnalysis === undefined
      ? {}
      : { sourceAnalysis: authoring.sourceAnalysis }),
    ...(authoring.authoringFacades === undefined
      ? {}
      : { authoringFacades: authoring.authoringFacades }),
  });
  const collection = loaded.descriptor.kind === "collection";
  const provider = collection && loaded.descriptor.entries.kind === "provider";
  const source: SourceState = Object.freeze({
    sourceId: resolved.sourceId,
    relativePath: resolved.relativePath,
    kind: loaded.compiled.interactive
      ? "interactive"
      : collection
        ? provider ? "provider-collection" : "static-collection"
        : "media",
    sourceDigest: sha256(readMediaSource(resolved)),
    programDigest: sha256(loaded.bundle.code),
    providerDigest: collection ? providerDigest(loaded.descriptor, root) : null,
  });
  return { resolved, loaded, source };
}

function requireFrozenProvider(
  state: NodeMediaControlState,
  snapshot: MediaCollectionSnapshot | undefined,
): void {
  if (state.source.kind === "provider-collection" && snapshot === undefined) {
    throw new Error("Controlled provider interactions require a supplied collection snapshot");
  }
}

function targetFor(
  interactionId: ControlledInteractionId,
  input: ControlledInput,
): Omit<TargetState, "registryDigest"> | null {
  if (interactionId === MEDIA_INTERACTION_IDS.compile) {
    const value = input as MediaArtifactCompileInteractionInput;
    return {
      kind: "artifact",
      targetId: value.target.targetId,
      logicalId: value.target.artifactId,
    };
  }
  if (interactionId === MEDIA_INTERACTION_IDS.export) {
    const value = input as MediaExportInteractionInput;
    return {
      kind: "publication",
      targetId: value.publication.targetId,
      logicalId: value.publication.publicationId,
    };
  }
  return null;
}

type TargetInspection =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "unknown" }>
  | Readonly<{
      status: "committed";
      kind: "artifact";
      digest: string;
      receipt: MediaArtifactCompileReceipt;
    }>
  | Readonly<{
      status: "committed";
      kind: "publication";
      digest: string;
      receipt: MediaExportReceipt;
    }>;

async function inspectBaseline(
  rootPath: string,
  logicalId: string,
  kind: MediaLogicalTargetKind,
): Promise<BaselineState> {
  const inspection = await inspectTargetPath(resolve(rootPath, logicalId), kind);
  return inspection.status === "committed"
    ? Object.freeze({ status: "committed", digest: inspection.digest })
    : Object.freeze({ status: inspection.status, digest: null });
}

async function inspectControlledTarget<Context>(
  _root: string,
  state: NodeMediaControlState,
  context: Context,
  targets: MediaTargetRegistry<Context>,
): Promise<TargetInspection> {
  if (state.target === null) return { status: "unknown" };
  const resolution = await targets.resolve({
    kind: state.target.kind,
    targetId: state.target.targetId,
    context,
  });
  if (resolution.registryDigest !== state.target.registryDigest) return { status: "unknown" };
  const path = resolveMediaTargetPath(resolution, state.target.logicalId);
  return inspectTargetPath(path, state.target.kind);
}

async function inspectTargetPath(
  path: string,
  kind: MediaLogicalTargetKind,
): Promise<TargetInspection> {
  if (!existsSync(path)) return { status: "missing" };
  try {
    if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory()) {
      return { status: "unknown" };
    }
    if (kind === "artifact") {
      const artifact = await readMediaArtifact(path);
      await verifyArtifactFiles(path, artifact.manifest.files.map((file) => file.path));
      const receipt: MediaArtifactCompileReceipt = Object.freeze({
        schemaVersion: 0,
        kind: "media-artifact",
        targetId: "",
        artifactId: "",
        artifactHash: artifact.manifest.artifactHash,
        programHash: artifact.media.hashes.programHash,
        intentHash: artifact.media.hashes.intentHash,
        markupHash: artifact.media.hashes.markupHash,
        coordinates: portableObject(artifact.media.identity),
        manifest: portableObject(artifact.manifest),
      });
      return { status: "committed", kind, digest: hashJson(receipt.manifest), receipt };
    }
    const manifest = portableObject(JSON.parse(await readFile(join(path, "export.json"), "utf8")));
    await verifyPublicationFiles(path, manifest);
    const receipt: MediaExportReceipt = Object.freeze({
      schemaVersion: 0,
      targetId: "",
      publicationId: "",
      manifestDigest: hashJson(manifest),
      manifest,
    });
    return { status: "committed", kind, digest: receipt.manifestDigest, receipt };
  } catch {
    return { status: "unknown" };
  }
}

async function inspectForReconciliation<Context, Input extends ControlledInput>(
  root: string,
  state: NodeMediaControlState<Input>,
  context: Context,
  targets: MediaTargetRegistry<Context>,
  authoring: NodeMediaAuthoringOptions,
): Promise<
  | Readonly<{ terminal: "uncertain" }>
  | Readonly<{ terminal: "not-applied"; reason: string }>
  | Readonly<{ inspection: Extract<TargetInspection, { status: "committed" }> }>
> {
  try {
    await assertCurrent(root, state, context, targets, authoring);
    if (state.baseline.status === "unknown") return { terminal: "uncertain" };
    const inspection = await inspectControlledTarget(root, state, context, targets);
    if (inspection.status === "unknown") return { terminal: "uncertain" };
    if (inspection.status === "missing") {
      return state.baseline.status === "missing"
        ? { terminal: "not-applied", reason: "logical media target remains absent" }
        : { terminal: "uncertain" };
    }
    if (
      state.baseline.status === "committed" &&
      state.baseline.digest === inspection.digest
    ) {
      return {
        terminal: "not-applied",
        reason: "logical media target remains at its exact baseline",
      };
    }
    return { inspection };
  } catch {
    return { terminal: "uncertain" };
  }
}

async function reconcileArtifactTarget<Context>(
  root: string,
  state: NodeMediaControlState<MediaArtifactCompileInteractionInput>,
  context: Context,
  targets: MediaTargetRegistry<Context>,
  authoring: NodeMediaAuthoringOptions,
) {
  const result = await inspectForReconciliation(root, state, context, targets, authoring);
  if ("terminal" in result) {
    return result.terminal === "uncertain"
      ? { status: "uncertain" } as const
      : { status: "not-applied", reason: result.reason } as const;
  }
  const inspection = result.inspection;
  if (inspection.kind === "artifact" && artifactMatchesState(inspection.receipt, state)) {
    return {
      status: "completed",
      value: withArtifactIdentity(inspection.receipt, state),
    } as const;
  }
  return { status: "uncertain" } as const;
}

async function reconcilePublicationTarget<Context>(
  root: string,
  state: NodeMediaControlState<MediaExportInteractionInput>,
  context: Context,
  targets: MediaTargetRegistry<Context>,
  authoring: NodeMediaAuthoringOptions,
) {
  const result = await inspectForReconciliation(root, state, context, targets, authoring);
  if ("terminal" in result) {
    return result.terminal === "uncertain"
      ? { status: "uncertain" } as const
      : { status: "not-applied", reason: result.reason } as const;
  }
  const inspection = result.inspection;
  if (
    inspection.kind === "publication" &&
    publicationMatchesState(inspection.receipt, state)
  ) {
    return {
      status: "completed",
      value: withPublicationIdentity(inspection.receipt, state),
    } as const;
  }
  return { status: "uncertain" } as const;
}

function artifactMatchesState(
  receipt: MediaArtifactCompileReceipt,
  state: NodeMediaControlState,
): boolean {
  if (state.interactionId !== MEDIA_INTERACTION_IDS.compile || state.target === null) return false;
  const input = state.input as MediaArtifactCompileInteractionInput;
  const coordinates = receipt.coordinates as Record<string, unknown>;
  const manifest = receipt.manifest as Record<string, unknown>;
  return manifest.schemaVersion === (input.artifactSchemaVersion ?? 0) &&
    coordinates.sourceId === state.source.sourceId &&
    (input.entryId === undefined || coordinates.entryId === input.entryId) &&
    (input.variantId === undefined || coordinates.variantId === input.variantId) &&
    (input.editionId === undefined || coordinates.editionId === input.editionId) &&
    (state.source.kind === "interactive" || receipt.programHash === state.source.programDigest);
}

function publicationMatchesState(
  receipt: MediaExportReceipt,
  state: NodeMediaControlState,
): boolean {
  if (state.interactionId !== MEDIA_INTERACTION_IDS.export || state.target === null) return false;
  const input = state.input as MediaExportInteractionInput;
  const manifest = receipt.manifest as Record<string, unknown>;
  const publication = manifest.publication as Record<string, unknown> | undefined;
  const runtime = manifest.runtime as Record<string, unknown> | undefined;
  if (
    manifest.sourceId !== state.source.sourceId ||
    publication?.targetId !== state.target.targetId ||
    publication.publicationId !== state.target.logicalId ||
    typeof runtime?.programDigest !== "string"
  ) return false;
  const requestDigest = hashJson({
    sourceId: state.source.sourceId,
    targetId: state.target.targetId,
    publicationId: state.target.logicalId,
    destinations: input.destinations,
    entryIds: input.entryIds ?? [],
    variantIds: input.variantIds ?? [],
    editionIds: input.editionIds ?? [],
    stillFrame: input.stillFrame ?? null,
    encoding: input.encoding ?? null,
    snapshotDigest: input.snapshot?.snapshotDigest ?? null,
    providerHash: input.snapshot?.providerHash ?? null,
    programDigest: runtime.programDigest,
  });
  return manifest.requestDigest === requestDigest &&
    manifest.destinationRegistryDigest === hashJson(ORGANIC_DESTINATIONS) &&
    (input.snapshot === undefined || (
      manifest.snapshotDigest === input.snapshot.snapshotDigest &&
      manifest.providerHash === input.snapshot.providerHash
    ));
}

function withArtifactIdentity(
  receipt: MediaArtifactCompileReceipt,
  state: NodeMediaControlState,
): MediaArtifactCompileReceipt {
  if (state.target === null) throw new Error("Artifact state has no target");
  return Object.freeze({
    ...receipt,
    targetId: state.target.targetId,
    artifactId: state.target.logicalId,
  });
}

function withPublicationIdentity(
  receipt: MediaExportReceipt,
  state: NodeMediaControlState,
): MediaExportReceipt {
  if (state.target === null) throw new Error("Publication state has no target");
  return Object.freeze({
    ...receipt,
    targetId: state.target.targetId,
    publicationId: state.target.logicalId,
  });
}

async function verifyPublicationFiles(root: string, manifest: MediaJsonObject): Promise<void> {
  const renditions = manifest.renditions;
  if (!Array.isArray(renditions)) throw new Error("Publication manifest has no renditions");
  const seen = new Set<string>();
  for (const value of renditions) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid rendition");
    const rendition = value as Record<string, unknown>;
    if (
      typeof rendition.path !== "string" || typeof rendition.sha256 !== "string" ||
      typeof rendition.bytes !== "number"
    ) throw new Error("Invalid rendition receipt");
    const path = confinedPath(root, rendition.path);
    const folded = path.normalize("NFC").toLocaleLowerCase("en-US");
    if (seen.has(folded)) throw new Error("Duplicate rendition path");
    seen.add(folded);
    const bytes = await readFile(path);
    if (bytes.byteLength !== rendition.bytes || sha256(bytes) !== rendition.sha256) {
      throw new Error("Publication rendition hash mismatch");
    }
  }
  // Unknown visible files indicate a mixed or partially overwritten result.
  const declared = new Set(renditions.map((value) => (value as Record<string, unknown>).path));
  for (const path of await listFiles(root)) {
    const name = relative(root, path).split(sep).join("/");
    if (name !== "export.json" && !declared.has(name)) throw new Error("Unknown publication file");
  }
}

async function verifyArtifactFiles(root: string, files: readonly string[]): Promise<void> {
  const declared = new Set(["artifact.json", ...files]);
  for (const path of await listFiles(root)) {
    const name = relative(root, path).split(sep).join("/");
    if (!declared.has(name)) throw new Error("Unknown artifact file");
  }
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Publication contains a symlink");
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) result.push(path);
      else throw new Error("Publication contains an unsupported entry");
    }
  };
  await visit(root);
  return result;
}

function confinedPath(root: string, child: string): string {
  if (!child || child.includes("\\") || child.includes("\0") || isAbsolute(child)) {
    throw new Error("Invalid publication path");
  }
  const path = resolve(root, child);
  const back = relative(root, path);
  if (!back || back === ".." || back.startsWith(`..${sep}`) || isAbsolute(back)) {
    throw new Error("Publication path escapes target");
  }
  return path;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function portableObject(value: unknown): MediaJsonObject {
  return JSON.parse(JSON.stringify(value)) as MediaJsonObject;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Media control verification failed";
}
