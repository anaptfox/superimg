import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { lstat, open, readFile, realpath, rename, chmod, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  assertEffectPolicy,
  invertOperation,
  validateMediaEditCommand,
} from "@superimg/core/edit";
import { diffMediaIR, selectVerificationFrames } from "@superimg/core";
import type {
  EditApplyResult,
  EditSourceBinding,
  EditTransaction,
  MediaCoordinates,
  MediaEditCommand,
  MediaIR,
  MediaElement,
  TemplateBundle,
} from "@superimg/types";
import { EditInteractionError, EditInteractionUncertainError } from "./edit-errors.js";
import { compileNodeEditableSource } from "./edit-compile-source.js";
import {
  extractEditBindings,
  hashEditSource,
  type EditableSourceFile,
} from "./edit-source-bindings.js";

export type NodeEditableSourceFile = EditableSourceFile & Readonly<{
  absolutePath: string;
}>;

export type NodeEditableCompilation = Readonly<{
  sourceId: string;
  coordinates: MediaCoordinates;
  media: MediaIR;
  files: readonly NodeEditableSourceFile[];
  /** Native executable snapshot; never a portable Interaction handler. */
  programCode?: string;
  /** Complete host-owned executable snapshot, including native resource sets. */
  programBundle?: TemplateBundle;
  /** Sampled resolved trees used to prove an exact node edit's target and value. */
  semanticCaptures?: readonly Readonly<{ frame: number; tree?: MediaElement }>[];
}>;

export type CompileEditableSourceArgs<Context> = Readonly<{
  source: string;
  context: Context;
  /** Project-relative source replacements used for a non-mutating planned compile. */
  overrides?: Readonly<Record<string, string>>;
  /** Request sampled resolved node trees for semantic edit verification. */
  captureNodeSemantics?: boolean;
  /** Additional global frames resolved independently from source. */
  semanticFrames?: readonly number[];
}>;

export type NodeEditEngineOptions<Context> = Readonly<{
  projectRoot: string;
  /** Host serialization and conditional source writes. Unknown writes must never be retried blindly. */
  writer?: NodeEditWriter;
  compileSource?(
    args: CompileEditableSourceArgs<Context>,
  ): Promise<NodeEditableCompilation> | NodeEditableCompilation;
}>;

export type NodeEditWriter = Readonly<{
  withLock<T>(work: () => Promise<T>): Promise<T>;
  replace(input: Readonly<{ relativePath: string; absolutePath: string; expectedHash: string; source: string }>): Promise<"applied" | "conflict" | "unknown">;
}>;

export type PlannedSourceReplacement = Readonly<{
  absolutePath: string;
  relativePath: string;
  before: string;
  after: string;
  beforeHash: string;
  afterHash: string;
}>;

export type NodeEditPlan = Readonly<{
  schemaVersion: 0;
  command: MediaEditCommand;
  beforeMedia: MediaIR;
  beforeProgramCode?: string;
  afterProgramCode?: string;
  beforeProgramBundle?: TemplateBundle;
  afterProgramBundle?: TemplateBundle;
  replacements: readonly PlannedSourceReplacement[];
  beforeSourceHashes: Readonly<Record<string, string>>;
  afterSourceHashes: Readonly<Record<string, string>>;
  beforeIntentHash: string;
  afterIntentHash: string;
  output: EditApplyResult;
}>;

export class NodeEditEngine<Context> {
  readonly #root: string;
  readonly #compileSource: NonNullable<NodeEditEngineOptions<Context>["compileSource"]>;
  readonly #writer: NodeEditWriter;
  #applying = false;

  constructor(options: NodeEditEngineOptions<Context>) {
    this.#root = realpathSync(resolve(options.projectRoot));
    this.#compileSource = options.compileSource ?? ((args) => compileNodeEditableSource(this.#root, args));
    this.#writer = options.writer ?? localWriter(this.#root);
  }

  async bindings(source: string, context: Context) {
    const compilation = await this.#compile(source, context);
    const extracted = extractEditBindings({
      coordinates: compilation.coordinates,
      intentHash: compilation.media.hashes.intentHash,
      files: compilation.files,
    });
    return Object.freeze({
      schemaVersion: 0 as const,
      kind: "media-edit-bindings" as const,
      source,
      sourceId: compilation.sourceId,
      manifest: extracted.manifest,
      sourceHashes: extracted.sourceHashes,
    });
  }

  async plan(raw: unknown, context: Context): Promise<NodeEditPlan> {
    const command = validateMediaEditCommand(raw);
    const captureNodeSemantics = command.kind === "set-node-text" || command.kind === "set-node-property";
    const observation = command.kind === "set-node-text" || command.kind === "set-node-property" ? command.observation : undefined;
    const before = await this.#compile(command.source, context, captureNodeSemantics, observation ? [observation.frame] : undefined);
    if (observation && (!sameCoordinates(observation.coordinates, before.coordinates) || observation.frame >= before.media.clock.totalFrames)) throw new EditInteractionError("INSUFFICIENT_OBSERVATION", "command.observation", "frame or media coordinates do not match the compiled source");
    const extracted = extractEditBindings({
      coordinates: before.coordinates,
      intentHash: before.media.hashes.intentHash,
      files: before.files,
    });
    assertPreconditions(command, extracted.sourceHashes, before.media.hashes.intentHash);
    const patches = patchesFor(command, extracted.manifest.bindings, before.media, before.files);
    const overrides: Record<string, string> = {};
    const replacements: PlannedSourceReplacement[] = [];
    for (const [relativePath, filePatches] of patches) {
      const file = before.files.find((candidate) => candidate.relativePath === relativePath)!;
      const afterSource = applyLiteralPatches(file.source, filePatches);
      overrides[relativePath] = afterSource;
      replacements.push({
        absolutePath: file.absolutePath,
        relativePath,
        before: file.source,
        after: afterSource,
        beforeHash: hashEditSource(file.source),
        afterHash: hashEditSource(afterSource),
      });
    }
    const after = await this.#compileSource({ source: command.source, context, overrides, ...(captureNodeSemantics ? { captureNodeSemantics: true } : {}), ...(observation ? { semanticFrames: [observation.frame] } : {}) });
    await this.#validateCompilation(after, false);
    if (observation && (!sameCoordinates(observation.coordinates, after.coordinates) || observation.frame >= after.media.clock.totalFrames)) throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command.observation", "edit changed the selected media coordinates or frame");
    if (command.kind === "set-node-text" || command.kind === "set-node-property") {
      const bindingId = command.kind === "set-node-text" ? command.target.textBindingId : command.target.bindingId;
      const binding = exactBinding(extracted.manifest.bindings, bindingId, command.target.nodeId);
      const beforeFrames = assertResolvedNodeValue(before, command, binding.value);
      const afterFrames = assertResolvedNodeValue(after, command, command.kind === "set-node-text" ? command.value.text : command.value.value);
      if (beforeFrames.join(",") !== afterFrames.join(",")) throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command.target", "resolved node visibility changed across sampled frames");
    }
    if (command.kind === "set-node-property" && command.target.property === "src") {
      const old = exactBinding(extracted.manifest.bindings, command.target.bindingId, command.target.nodeId).value;
      const unaffected = (media: MediaIR) => media.assets.filter((asset) => asset.src !== old && asset.src !== command.value.value);
      if (JSON.stringify(unaffected(before.media)) !== JSON.stringify(unaffected(after.media))) {
        throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command", "asset edit changed unrelated assets");
      }
    }
    if (command.kind === "set-composition-hold") {
      assertCompositionHoldTarget(command, after.media);
    }
    const diff = diffMediaIR(before.media, after.media);
    try {
      assertEffectPolicy(command, diff, { before: before.media, after: after.media });
    } catch (cause) {
      throw new EditInteractionError(
        "EFFECT_POLICY_VIOLATION",
        "command",
        cause instanceof Error ? cause.message : "edit effect policy failed",
        { cause },
      );
    }
    const beforeSourceHashes = extracted.sourceHashes;
    const afterSourceHashes = Object.freeze({
      ...beforeSourceHashes,
      ...Object.fromEntries(replacements.map((entry) => [entry.relativePath, entry.afterHash])),
    });
    const inverse = inverseFor(command, extracted.manifest.bindings, before.media, {
      intentHash: after.media.hashes.intentHash,
      sourceHashes: { ...afterSourceHashes },
    });
    const afterBindings = extractEditBindings({
      coordinates: after.coordinates,
      intentHash: after.media.hashes.intentHash,
      files: after.files.map((file) => ({
        ...file,
        source: overrides[file.relativePath] ?? file.source,
      })),
    });
    if (command.kind === "set-node-property") {
      const current = exactBinding(afterBindings.manifest.bindings, command.target.bindingId, command.target.nodeId);
      if (current.propertyPath !== `property.${command.target.property}` || current.value !== command.value.value) throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command", "compiled property binding does not match requested value");
    }
    const transactionId = digest({ command, beforeSourceHashes, afterSourceHashes });
    const transaction: EditTransaction = {
      schemaVersion: 0,
      transactionId,
      operation: command,
      state: "committed",
      beforeSourceHashes: { ...beforeSourceHashes },
      afterSourceHashes: { ...afterSourceHashes },
      inverse,
    };
    const output: EditApplyResult = {
      schemaVersion: 0,
      transaction,
      manifest: afterBindings.manifest,
      media: after.media,
      diff,
      verificationFrames: selectVerificationFrames(diff, { limit: 9 }),
      changedPaths: replacements.map((entry) => entry.relativePath),
      diagnostics: [],
    };
    return Object.freeze({
      schemaVersion: 0,
      command,
      beforeMedia: before.media,
      ...(before.programCode !== undefined ? { beforeProgramCode: before.programCode } : {}),
      ...(after.programCode !== undefined ? { afterProgramCode: after.programCode } : {}),
      ...(before.programBundle !== undefined ? { beforeProgramBundle: before.programBundle } : {}),
      ...(after.programBundle !== undefined ? { afterProgramBundle: after.programBundle } : {}),
      replacements: replacements.map((entry) => Object.freeze(entry)),
      beforeSourceHashes,
      afterSourceHashes,
      beforeIntentHash: before.media.hashes.intentHash,
      afterIntentHash: after.media.hashes.intentHash,
      output,
    });
  }

  /** Default serialization is process-local; filesystem rename is not a CAS. */
  async apply(plan: NodeEditPlan, context: Context): Promise<EditApplyResult> {
    if (this.#applying) throw new EditInteractionError("CONTROL_UNAVAILABLE", "apply", "another edit is being applied by this engine");
    this.#applying = true;
    let entered = false, attempted = false, innerError: unknown;
    try {
      const result = await this.#writer.withLock(async () => {
        entered = true;
        try { return await this.#apply(plan, context, () => { attempted = true; }); }
        catch (error) { innerError = error; throw error; }
      });
      if (!entered) throw new Error("Source writer did not execute the edit");
      return result;
    } catch (error) {
      if (error === innerError) throw error;
      if (attempted) throw new EditInteractionUncertainError("source writer lock failed after an edit effect may have started", { cause: error });
      throw error;
    } finally { this.#applying = false; }
  }

  async #apply(plan: NodeEditPlan, context: Context, markAttempt: () => void): Promise<EditApplyResult> {
    const baseline = await this.#compile(plan.command.source, context);
    if (!sameHashes(hashFiles(baseline.files), plan.beforeSourceHashes) || baseline.media.hashes.intentHash !== plan.beforeIntentHash) throw new EditInteractionError("SOURCE_STALE", "apply", "source changed after planning");
    await this.#assertFiles(plan.replacements, "before");
    const written: PlannedSourceReplacement[] = [];
    try {
      for (const replacement of plan.replacements) {
        await this.#assertFiles([replacement], "before");
        markAttempt();
        const result = await this.#replace(replacement, "after");
        if (result === "unknown") throw new EditInteractionUncertainError("source write outcome is unknown");
        if (result === "conflict") throw new EditInteractionError("SOURCE_STALE", replacement.relativePath, "source writer rejected a stale revision");
        written.push(replacement);
      }
      const actual = await this.#compileForVerification(plan, context);
      const actualHashes = hashFiles(actual.files);
      if (!sameHashes(actualHashes, plan.afterSourceHashes) ||
        actual.media.hashes.intentHash !== plan.afterIntentHash) {
        throw new EditInteractionError(
          "EFFECT_POLICY_VIOLATION",
          "apply",
          "post-write compilation does not match the planned edit",
        );
      }
      return plan.output;
    } catch (cause) {
      if (cause instanceof EditInteractionUncertainError || written.length === 0) throw cause;
      try {
        for (const replacement of [...written].reverse()) {
          await this.#assertFiles([replacement], "after");
          const result = await this.#replace(replacement, "before");
          if (result !== "applied") throw new Error(`rollback ${result}`);
        }
        await this.#validateCompilation(baseline);
      } catch (rollbackCause) {
        throw new EditInteractionUncertainError(
          "edit failed and the original source state could not be proven restored",
          { cause: new AggregateError([cause, rollbackCause], "edit and rollback failed") },
        );
      }
      throw cause;
    }
  }

  async #replace(replacement: PlannedSourceReplacement, state: "before" | "after") {
    try {
      const result = await this.#writer.replace({ relativePath: replacement.relativePath, absolutePath: replacement.absolutePath, expectedHash: state === "after" ? replacement.beforeHash : replacement.afterHash, source: state === "after" ? replacement.after : replacement.before });
      if (result !== "applied" && result !== "conflict" && result !== "unknown") throw new TypeError("Invalid source writer result");
      return result;
    } catch (cause) {
      throw new EditInteractionUncertainError("source writer threw after a write may have started", { cause });
    }
  }

  async execute(command: MediaEditCommand, context: Context): Promise<EditApplyResult> {
    return this.apply(await this.plan(command, context), context);
  }

  async verify(plan: NodeEditPlan, output: EditApplyResult, context: Context) {
    if (output.transaction.transactionId !== plan.output.transaction.transactionId) {
      return { ok: false as const, message: "edit transaction identity changed" };
    }
    try {
      await this.#assertFiles(plan.replacements, "after");
      const actual = await this.#compileForVerification(plan, context);
      if (!sameHashes(hashFiles(actual.files), plan.afterSourceHashes)) return { ok: false as const, message: "post-edit source hashes changed" };
      if (actual.media.hashes.intentHash !== plan.afterIntentHash) {
        return { ok: false as const, message: "post-edit intent hash changed" };
      }
      const actualDiff = diffMediaIR(plan.beforeMedia, actual.media);
      if (digest(actualDiff) !== digest(plan.output.diff)) {
        return { ok: false as const, message: "post-edit Media IR diff changed" };
      }
      const actualFrames = selectVerificationFrames(actualDiff, { limit: 9 });
      if (
        actualFrames.length > 9 ||
        digest(actualFrames) !== digest(plan.output.verificationFrames)
      ) {
        return { ok: false as const, message: "bounded verification frames changed" };
      }
      return {
        ok: true as const,
        evidence: {
          transactionId: output.transaction.transactionId,
          intentHash: actual.media.hashes.intentHash,
          sourceHashes: { ...plan.afterSourceHashes },
          verificationFrames: actualFrames,
        },
      };
    } catch (cause) {
      return {
        ok: false as const,
        message: cause instanceof Error ? cause.message : "edit verification failed",
      };
    }
  }

  async reconcile(plan: NodeEditPlan, context: Context) {
    try {
      const actual = await this.#compile(plan.command.source, context);
      const current = hashFiles(actual.files);
      if (sameHashes(current, plan.afterSourceHashes)) {
        const verification = await this.verify(plan, plan.output, context);
        return verification.ok ? { status: "completed" as const, value: plan.output } : { status: "uncertain" as const };
      }
      if (sameHashes(current, plan.beforeSourceHashes) && actual.media.hashes.intentHash === plan.beforeIntentHash) {
        return { status: "not-applied" as const, reason: "complete source remains at the planned baseline" };
      }
    } catch { /* Inaccessible or inconsistent source cannot establish an outcome. */ }
    return { status: "uncertain" as const };
  }

  async #compileForVerification(plan: NodeEditPlan, context: Context): Promise<NodeEditableCompilation> {
    const command = plan.command;
    const nodeCommand = command.kind === "set-node-text" || command.kind === "set-node-property" ? command : undefined;
    const observation = nodeCommand?.observation;
    const actual = await this.#compile(command.source, context, !!nodeCommand, observation ? [observation.frame] : undefined);
    if (observation && (!sameCoordinates(observation.coordinates, actual.coordinates) || observation.frame >= actual.media.clock.totalFrames)) {
      throw new EditInteractionError("INSUFFICIENT_OBSERVATION", "command.observation", "selected frame or coordinates changed");
    }
    if (nodeCommand) assertResolvedNodeValue(actual, nodeCommand, nodeCommand.kind === "set-node-text" ? nodeCommand.value.text : nodeCommand.value.value);
    return actual;
  }

  async #compile(source: string, context: Context, captureNodeSemantics = false, semanticFrames?: readonly number[]): Promise<NodeEditableCompilation> {
    const compilation = await this.#compileSource({ source, context, ...(captureNodeSemantics ? { captureNodeSemantics: true } : {}), ...(semanticFrames ? { semanticFrames } : {}) });
    await this.#validateCompilation(compilation);
    return compilation;
  }

  async #validateCompilation(
    compilation: NodeEditableCompilation,
    verifyDisk = true,
  ): Promise<void> {
    const paths = new Set<string>();
    for (const file of compilation.files) {
      if (paths.has(file.relativePath)) {
        throw new EditInteractionError("INVALID_OUTPUT", "compileSource.files", "duplicate editable source path");
      }
      paths.add(file.relativePath);
      const absolutePath = resolve(file.absolutePath);
      const expectedPath = resolve(this.#root, file.relativePath);
      const back = relative(this.#root, expectedPath);
      if (isAbsolute(file.relativePath) || file.relativePath.includes("\\") ||
        back === ".." || back.startsWith(`..${sep}`) || isAbsolute(back)) {
        throw new EditInteractionError("INVALID_OUTPUT", "compileSource.files", "editable source escapes project root");
      }
      const metadata = await lstat(absolutePath);
      const realRoot = await realpath(this.#root);
      const realFile = await realpath(absolutePath);
      const expectedRealFile = await realpath(expectedPath);
      const realBack = relative(realRoot, realFile);
      if (!metadata.isFile() || metadata.isSymbolicLink() || realFile !== expectedRealFile || realBack === ".." ||
        realBack.startsWith(`..${sep}`) || isAbsolute(realBack)) {
        throw new EditInteractionError("INVALID_OUTPUT", "compileSource.files", "editable source must be a regular non-symlink file");
      }
      if (verifyDisk) {
        const actual = await readFile(absolutePath, "utf8");
        if (actual !== file.source) {
          throw new EditInteractionError("SOURCE_STALE", file.relativePath, "compiler source snapshot is stale");
        }
      }
    }
  }

  async #assertFiles(
    replacements: readonly PlannedSourceReplacement[],
    state: "before" | "after",
  ): Promise<void> {
    for (const replacement of replacements) {
      const metadata = await lstat(replacement.absolutePath);
      const realRoot = await realpath(this.#root);
      const realFile = await realpath(replacement.absolutePath);
      const back = relative(realRoot, realFile);
      if (!metadata.isFile() || metadata.isSymbolicLink() || back === ".." ||
        back.startsWith(`..${sep}`) || isAbsolute(back)) {
        throw new EditInteractionError("SOURCE_STALE", replacement.relativePath, "source path changed after planning");
      }
      const source = await readFile(replacement.absolutePath, "utf8");
      const expected = state === "before" ? replacement.beforeHash : replacement.afterHash;
      if (hashEditSource(source) !== expected) {
        throw new EditInteractionError("SOURCE_STALE", replacement.relativePath, `source is not at planned ${state} state`);
      }
    }
  }


}

type LiteralPatch = Readonly<{
  startByte: number;
  endByte: number;
  expectedText: string;
  replacement: string;
}>;

function assertResolvedNodeValue(
  compilation: NodeEditableCompilation,
  command: Extract<MediaEditCommand, { kind: "set-node-text" | "set-node-property" }>,
  expected: unknown,
): number[] {
  const split = command.target.nodeId.indexOf("::");
  const sceneId = command.target.nodeId.slice(0, split);
  const localId = command.target.nodeId.slice(split + 2);
  const captures = compilation.semanticCaptures;
  if (split < 1 || !localId || !captures?.length) throw new EditInteractionError("INSUFFICIENT_OBSERVATION", "command.target", "resolved tree evidence is unavailable");
  const observed: number[] = [];
  for (const capture of captures) {
    const scene = compilation.media.scenes.find((item) => item.id === sceneId && capture.frame >= item.range.startFrame && capture.frame < item.range.endFrame);
    if (!scene) continue;
    if (!capture.tree) throw new EditInteractionError("INSUFFICIENT_OBSERVATION", "command.target", "resolved tree evidence is unavailable for a sampled frame");
    const matches: MediaElement[] = [];
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { for (const child of value) visit(child); return; }
      if (!value || typeof value !== "object") return;
      const node = value as MediaElement;
      if (node.$$typeof !== "@foxworth/superimg/element") return;
      if (node.props.id === localId) matches.push(node);
      visit(node.children);
    };
    visit(capture.tree);
    if (matches.length === 0) continue;
    if (matches.length !== 1) throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command.target", "resolved node identity is ambiguous");
    const node = matches[0]!;
    if (command.kind === "set-node-property") {
      const property = command.target.property;
      const allowed = property === "color" || property === "size" || property === "weight" ? ["Text"]
        : property === "fill" ? ["Frame"] : property === "src" ? ["Image", "Video"] : ["Frame", "Image", "Video"];
      if (!allowed.includes(node.type)) throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command.target", "resolved node has an incompatible constructor");
    }
    const actual = command.kind === "set-node-text" ? (node.type === "Text" && node.children.length === 1 ? node.children[0] : undefined) : node.props[command.target.property];
    if (actual !== expected) throw new EditInteractionError("EFFECT_POLICY_VIOLATION", "command.target", "resolved node value does not match the edit");
    observed.push(capture.frame);
  }
  if (!observed.length || (command.observation && !observed.includes(command.observation.frame))) throw new EditInteractionError("INSUFFICIENT_OBSERVATION", "command.target", "target was not present in the requested resolved frame");
  return observed.sort((a, b) => a - b);
}

function sameCoordinates(a: MediaCoordinates, b: MediaCoordinates): boolean {
  return a.sourceId === b.sourceId && a.entryId === b.entryId && a.variantId === b.variantId && a.editionId === b.editionId;
}

function patchesFor(
  command: MediaEditCommand,
  bindings: readonly EditSourceBinding[],
  media: MediaIR,
  files: readonly NodeEditableSourceFile[],
): Map<string, LiteralPatch[]> {
  if (command.kind === "set-audio-clip-placement") {
    const b = exactBinding(bindings, command.target.bindingId, `audio::${command.target.clipId}`);
    if (b.propertyPath !== "audio.placement.at" || b.source?.syntaxKind !== "string-duration") throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.bindingId, "binding is not an inline audio placement");
    const tracks = media.tracks.filter((track) => track.id === `audio::${command.target.clipId}` && track.kind === "audio");
    if (tracks.length !== 1 || tracks[0]?.meta?.startSeconds !== b.value) throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.clipId, "source placement does not identify one resolved audio track");
    return groupPatches([patchFor(b, files, JSON.stringify(`${formatNumber(command.value.atSeconds)}s`))]);
  }
  if (command.kind === "set-node-property") {
    const b = exactBinding(bindings, command.target.bindingId, command.target.nodeId);
    const stringProperty = ["color", "fill", "src"].includes(command.target.property);
    if (b.propertyPath !== `property.${command.target.property}` || b.source?.syntaxKind !== (stringProperty ? "string-literal" : "number-literal")) throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.bindingId, "binding does not match the supported property");
    return groupPatches([patchFor(b, files, typeof command.value.value === "string" ? JSON.stringify(command.value.value) : formatNumber(command.value.value))]);
  }
  if (command.kind === "set-node-text") {
    const b = exactBinding(bindings, command.target.textBindingId, command.target.nodeId);
    if (b.propertyPath !== "text" || b.source?.syntaxKind !== "string-literal") throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.textBindingId, "binding is not a literal text child");
    return groupPatches([patchFor(b, files, JSON.stringify(command.value.text))]);
  }
  if (command.kind === "set-node-transform") {
    const x = exactBinding(bindings, command.target.xBindingId, command.target.nodeId);
    const y = exactBinding(bindings, command.target.yBindingId, command.target.nodeId);
    if (x.propertyPath !== "initial.transform.x" || y.propertyPath !== "initial.transform.y") {
      throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target", "x/y bindings must match their respective axes");
    }
    if (x.source!.relativePath !== y.source!.relativePath) {
      throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target", "x/y bindings must share one source file");
    }
    return groupPatches([
      patchFor(x, files, formatNumber(command.value.x)),
      patchFor(y, files, formatNumber(command.value.y)),
    ]);
  }
  if (command.kind === "trim-scene-end") {
    const duration = exactBinding(bindings, command.target.durationBindingId, command.target.sceneId);
    const scene = media.scenes.find((candidate) => candidate.id === command.target.sceneId);
    if (!scene) throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target.sceneId", "scene is absent from Media IR");
    const frames = command.end.frame - scene.range.startFrame;
    if (!Number.isInteger(frames) || frames < 1) {
      throw new EditInteractionError("INVALID_INPUT", "command.end.frame", "trim must leave at least one scene frame");
    }
    return groupPatches([patchFor(duration, files, `"${frames}f"`)]);
  }
  if (command.kind === "set-composition-hold") {
    const hold = exactBinding(
      bindings,
      command.target.holdBindingId,
      command.target.occurrencePath,
    );
    if (hold.propertyPath !== "composition.hold") {
      throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.holdBindingId, "binding is not a retained-composition still hold");
    }
    assertCompositionHoldTarget(command, media);
    return groupPatches([patchFor(hold, files, JSON.stringify(command.value.hold))]);
  }
  const left = exactBinding(bindings, command.target.leftBindingId, command.target.sceneId);
  const right = exactBinding(bindings, command.target.rightBindingId, command.target.sceneId);
  if (left.source!.relativePath !== right.source!.relativePath) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target", "phase bindings must share one source file");
  }
  assertAdjacentPhases(command, bindings, left, right);
  const leftRaw = bindingText(left, files);
  const rightRaw = bindingText(right, files);
  if (phaseUnit(leftRaw) !== command.unit || phaseUnit(rightRaw) !== command.unit) {
    throw new EditInteractionError("INVALID_INPUT", "command.unit", "phase units must match both source literals");
  }
  const beforeTotal = Number(left.value) + Number(right.value);
  const afterTotal = command.value.left + command.value.right;
  if (Math.abs(beforeTotal - afterTotal) > 1e-9) {
    throw new EditInteractionError("INVALID_INPUT", "command.value", "phase rebalance must preserve the adjacent total");
  }
  return groupPatches([
    patchFor(left, files, formatPhase(command.value.left, command.unit)),
    patchFor(right, files, formatPhase(command.value.right, command.unit)),
  ]);
}

function inverseFor(
  command: MediaEditCommand,
  bindings: readonly EditSourceBinding[],
  media: MediaIR,
  expected: MediaEditCommand["expected"],
): MediaEditCommand {
  if (command.kind === "set-audio-clip-placement") {
    const b = exactBinding(bindings, command.target.bindingId, `audio::${command.target.clipId}`);
    if (typeof b.value !== "number") throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.bindingId, "placement is not numeric");
    return invertOperation(command, { kind: command.kind, atSeconds: b.value }, expected);
  }
  if (command.kind === "set-node-property") {
    const b = exactBinding(bindings, command.target.bindingId, command.target.nodeId);
    if (typeof b.value !== "string" && typeof b.value !== "number") throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.bindingId, "property value is not literal");
    return invertOperation(command, { kind: command.kind, value: b.value }, expected);
  }
  if (command.kind === "set-node-text") {
    const b = exactBinding(bindings, command.target.textBindingId, command.target.nodeId);
    if (typeof b.value !== "string") throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.textBindingId, "text binding has no literal value");
    return invertOperation(command, { kind: command.kind, text: b.value }, expected);
  }
  if (command.kind === "set-node-transform") {
    const x = exactBinding(bindings, command.target.xBindingId, command.target.nodeId);
    const y = exactBinding(bindings, command.target.yBindingId, command.target.nodeId);
    return invertOperation(command, {
      kind: command.kind, x: Number(x.value), y: Number(y.value),
    }, expected);
  }
  if (command.kind === "trim-scene-end") {
    const scene = media.scenes.find((candidate) => candidate.id === command.target.sceneId)!;
    return invertOperation(command, { kind: command.kind, endFrame: scene.range.endFrame }, expected);
  }
  if (command.kind === "set-composition-hold") {
    const hold = exactBinding(bindings, command.target.holdBindingId, command.target.occurrencePath);
    if (typeof hold.value !== "string") {
      throw new EditInteractionError("BINDING_UNAVAILABLE", command.target.holdBindingId, "hold binding does not retain a string duration");
    }
    return invertOperation(command, {
      kind: command.kind,
      hold: hold.value,
    }, expected);
  }
  const left = exactBinding(bindings, command.target.leftBindingId, command.target.sceneId);
  const right = exactBinding(bindings, command.target.rightBindingId, command.target.sceneId);
  return invertOperation(command, {
    kind: command.kind, left: Number(left.value), right: Number(right.value),
  }, expected);
}

function exactBinding(
  bindings: readonly EditSourceBinding[],
  bindingId: string,
  targetId: string,
): EditSourceBinding {
  const candidates = bindings.filter((binding) => binding.bindingId === bindingId);
  const binding = candidates.length === 1 ? candidates[0] : undefined;
  if (!binding || binding.targetId !== targetId || binding.capability !== "exact" || !binding.source) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", bindingId, "edit requires one exact current source binding");
  }
  return binding;
}

function assertAdjacentPhases(
  command: Extract<MediaEditCommand, { kind: "set-phase-boundary" }>,
  bindings: readonly EditSourceBinding[],
  left: EditSourceBinding,
  right: EditSourceBinding,
): void {
  if (left.propertyPath !== `phases.${command.target.leftPhaseName}` ||
    right.propertyPath !== `phases.${command.target.rightPhaseName}`) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target", "phase names do not match bindings");
  }
  const ordered = bindings.filter((binding) =>
    binding.targetId === command.target.sceneId && binding.propertyPath.startsWith("phases.") &&
    binding.source?.relativePath === left.source?.relativePath && binding.source
  ).sort((a, b) => a.source!.startByte - b.source!.startByte);
  if (ordered.indexOf(right) !== ordered.indexOf(left) + 1) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target", "phase bindings are not adjacent literals");
  }
}

/**
 * A source literal is editable only when the compiled retained schedule has
 * exactly that selected still occurrence. This prevents edits to an equally
 * named path in an unselected choice branch or an unrelated source shape.
 */
function assertCompositionHoldTarget(
  command: Extract<MediaEditCommand, { kind: "set-composition-hold" }>,
  media: MediaIR,
): void {
  const extension = media.extensions["superimg.composition"];
  const payload = extension?.payload;
  if (!isRecord(payload) || !isRecord(payload.schedule) || !Array.isArray(payload.schedule.leaves)) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target.occurrencePath", "edit requires a retained composition schedule");
  }
  const matches = payload.schedule.leaves.filter((leaf) =>
    isRecord(leaf) && leaf.path === command.target.occurrencePath
  );
  if (matches.length !== 1) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target.occurrencePath", "occurrence path is not exactly one selected schedule leaf");
  }
  const leaf = matches[0];
  if (!isRecord(leaf)) {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target.occurrencePath", "schedule leaf is not a portable object");
  }
  if (leaf.kind === "video") {
    throw new EditInteractionError("BINDING_UNAVAILABLE", "command.target.occurrencePath", "only still composition occurrences have editable holds");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function patchFor(
  binding: EditSourceBinding,
  files: readonly NodeEditableSourceFile[],
  replacement: string,
): LiteralPatch & { relativePath: string } {
  const location = binding.source!;
  return {
    relativePath: location.relativePath,
    startByte: location.startByte,
    endByte: location.endByte,
    expectedText: bindingText(binding, files),
    replacement,
  };
}

function bindingText(binding: EditSourceBinding, files: readonly NodeEditableSourceFile[]): string {
  const location = binding.source!;
  const source = files.find((file) => file.relativePath === location.relativePath)?.source;
  if (source === undefined) throw new EditInteractionError("BINDING_UNAVAILABLE", binding.bindingId, "binding source file is absent");
  return Buffer.from(source, "utf8").subarray(location.startByte, location.endByte).toString("utf8");
}

function groupPatches(patches: Array<LiteralPatch & { relativePath: string }>) {
  const grouped = new Map<string, LiteralPatch[]>();
  for (const { relativePath, ...patch } of patches) {
    grouped.set(relativePath, [...(grouped.get(relativePath) ?? []), patch]);
  }
  return grouped;
}

function applyLiteralPatches(source: string, patches: readonly LiteralPatch[]): string {
  let output = Buffer.from(source, "utf8");
  const ordered = [...patches].sort((a, b) => b.startByte - a.startByte);
  for (const patch of ordered) {
    const current = output.subarray(patch.startByte, patch.endByte).toString("utf8");
    if (current !== patch.expectedText) {
      throw new EditInteractionError("SOURCE_STALE", "patch", "source literal changed before planning completed");
    }
    output = Buffer.concat([
      output.subarray(0, patch.startByte), Buffer.from(patch.replacement, "utf8"),
      output.subarray(patch.endByte),
    ]);
  }
  return output.toString("utf8");
}

const projectLocks = new Map<string, Promise<void>>();
function localWriter(root: string): NodeEditWriter {
  return {
    async withLock<T>(work: () => Promise<T>): Promise<T> {
      const previous = projectLocks.get(root) ?? Promise.resolve();
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      const tail = previous.then(() => held);
      projectLocks.set(root, tail);
      await previous;
      try { return await work(); }
      finally { release(); if (projectLocks.get(root) === tail) projectLocks.delete(root); }
    },
    async replace(input) {
      try { await atomicReplace(input.absolutePath, input.source, input.expectedHash); return "applied"; }
      catch (error) { if (error instanceof EditInteractionError && error.code === "SOURCE_STALE") return "conflict"; throw error; }
    },
  };
}

async function atomicReplace(
  path: string,
  source: string,
  expectedHash: string,
): Promise<void> {
  const mode = (await lstat(path)).mode;
  const temporary = resolve(dirname(path), `.${randomUUID()}.superimg-edit.tmp`);
  const handle = await open(temporary, "wx", mode);
  try {
    await handle.writeFile(source, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await chmod(temporary, mode);
    if (hashEditSource(await readFile(path, "utf8")) !== expectedHash) {
      throw new EditInteractionError(
        "SOURCE_STALE",
        path,
        "source changed before atomic publication",
      );
    }
    await rename(temporary, path);
  } catch (cause) {
    await unlink(temporary).catch(() => undefined);
    throw cause;
  }
}

function assertPreconditions(
  command: MediaEditCommand,
  sourceHashes: Readonly<Record<string, string>>,
  intentHash: string,
): void {
  if (command.expected.intentHash !== intentHash ||
    !sameHashes(command.expected.sourceHashes, sourceHashes)) {
    throw new EditInteractionError("SOURCE_STALE", "command.expected", "edit preconditions do not match current source and intent");
  }
}

function hashFiles(files: readonly NodeEditableSourceFile[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file.relativePath, hashEditSource(file.source)]));
}

function sameHashes(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && left[key] === right[key]
  );
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new EditInteractionError("INVALID_INPUT", "command.value", "position must be finite");
  return String(value);
}

function phaseUnit(text: string): "percent" | "seconds" | undefined {
  if (/^['\"](?:\d+(?:\.\d+)?|\.\d+)%['\"]$/.test(text)) return "percent";
  if (/^['\"](?:\d+(?:\.\d+)?|\.\d+)s['\"]$/.test(text)) return "seconds";
  return undefined;
}

function formatPhase(value: number, unit: "percent" | "seconds"): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new EditInteractionError("INVALID_INPUT", "command.value", "phase weights must be finite and positive");
  }
  return `"${value}${unit === "percent" ? "%" : "s"}"`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  ).map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
}
