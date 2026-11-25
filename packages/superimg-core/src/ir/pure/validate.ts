//! Strict schema-0 Media IR validation.

import type { MediaIR, MediaIRFrameRange } from "@superimg/types";
import { MediaIRError } from "./errors.js";

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MediaIRError("invalid_type", `${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
): void {
  const known = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      throw new MediaIRError("invalid_schema", `${path}.${key} is not part of Media IR schema 0`);
    }
  }
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new MediaIRError("invalid_type", `${path} must be an array`);
  }
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new MediaIRError("invalid_type", `${path} must be a non-empty string`);
  }
  return value;
}

function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MediaIRError("invalid_type", `${path} must be a finite number`);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new MediaIRError("invalid_type", `${path} must be a boolean`);
  }
  return value;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new MediaIRError(
      "invalid_type",
      `${path} must be one of ${allowed.join(", ")}`,
    );
  }
  return value as T[number];
}

function json(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    number(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => json(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      json(item, `${path}.${key}`);
    }
    return;
  }
  throw new MediaIRError("invalid_type", `${path} must be JSON-compatible`);
}

function range(
  value: unknown,
  path: string,
  totalFrames: number,
): MediaIRFrameRange {
  const candidate = object(value, path);
  exactKeys(candidate, path, ["startFrame", "endFrame"]);
  const startFrame = number(candidate.startFrame, `${path}.startFrame`);
  const endFrame = number(candidate.endFrame, `${path}.endFrame`);
  if (
    !Number.isSafeInteger(startFrame) ||
    !Number.isSafeInteger(endFrame) ||
    startFrame < 0 ||
    startFrame >= endFrame ||
    endFrame > totalFrames
  ) {
    throw new MediaIRError(
      "invalid_range",
      `${path} must be a valid half-open range inside the media clock`,
    );
  }
  return { startFrame, endFrame };
}

function unique(values: string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new MediaIRError("unstable_identity", `${path} contains duplicate id ${value}`);
    }
    seen.add(value);
  }
}

function hash(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^[a-f0-9]{64}$/i.test(result)) {
    throw new MediaIRError("missing_hash", `${path} must be a 64-character hex digest`);
  }
  return result;
}

function runsCoverClock(value: unknown, path: string, totalFrames: number): void {
  const runs = array(value, path);
  if (runs.length === 0) {
    throw new MediaIRError("invalid_range", `${path} must cover the full frame clock`);
  }
  let cursor = 0;
  runs.forEach((value, index) => {
    const runPath = `${path}[${index}]`;
    const run = object(value, runPath);
    exactKeys(run, runPath, ["range", "hash"]);
    const runRange = range(run.range, `${runPath}.range`, totalFrames);
    hash(run.hash, `${runPath}.hash`);
    if (runRange.startFrame !== cursor) {
      throw new MediaIRError("invalid_range", `${path} must be sorted and contiguous`);
    }
    cursor = runRange.endFrame;
  });
  if (cursor !== totalFrames) {
    throw new MediaIRError("invalid_range", `${path} must end at clock.totalFrames`);
  }
}

export function validateMediaIR(value: unknown): MediaIR {
  const root = object(value, "MediaIR");
  exactKeys(root, "MediaIR", [
    "kind",
    "schemaVersion",
    "identity",
    "medium",
    "animated",
    "canvas",
    "renderConfig",
    "clock",
    "capabilities",
    "provenance",
    "scenes",
    "tracks",
    "motions",
    "assets",
    "observations",
    "hashes",
    "extensions",
  ]);
  if (root.kind !== "@foxworth/superimg/media-ir") {
    throw new MediaIRError("invalid_schema", "MediaIR.kind must be @foxworth/superimg/media-ir");
  }
  if (root.schemaVersion !== 0) {
    throw new MediaIRError("unknown_version", `Unsupported schemaVersion ${String(root.schemaVersion)}`, {
      schemaVersion: root.schemaVersion,
    });
  }

  const identity = object(root.identity, "identity");
  exactKeys(identity, "identity", ["sourceId", "entryId", "variantId", "editionId"]);
  string(identity.sourceId, "identity.sourceId");
  if (identity.entryId !== undefined) string(identity.entryId, "identity.entryId");
  string(identity.variantId, "identity.variantId");
  string(identity.editionId, "identity.editionId");

  if (root.medium !== "html" && root.medium !== "svg") {
    throw new MediaIRError("invalid_type", "medium must be html or svg");
  }
  boolean(root.animated, "animated");

  const canvas = object(root.canvas, "canvas");
  exactKeys(canvas, "canvas", ["width", "height"]);
  if (number(canvas.width, "canvas.width") <= 0 || number(canvas.height, "canvas.height") <= 0) {
    throw new MediaIRError("invalid_range", "canvas dimensions must be greater than zero");
  }

  const renderConfig = object(root.renderConfig, "renderConfig");
  exactKeys(renderConfig, "renderConfig", [
    "fonts",
    "inlineCss",
    "stylesheets",
    "tailwind",
    "background",
    "watermark",
    "readiness",
    "mode",
  ]);
  for (const key of ["fonts", "inlineCss", "stylesheets"] as const) {
    const values = array(renderConfig[key], `renderConfig.${key}`);
    values.forEach((item, index) => string(item, `renderConfig.${key}[${index}]`));
  }
  for (const key of ["tailwind", "background", "watermark", "readiness"] as const) {
    if (!(key in renderConfig)) {
      throw new MediaIRError("invalid_schema", `renderConfig.${key} is required`);
    }
    json(renderConfig[key], `renderConfig.${key}`);
  }
  if (renderConfig.mode !== "frame" && renderConfig.mode !== "animation") {
    throw new MediaIRError("invalid_type", "renderConfig.mode must be frame or animation");
  }

  const clock = object(root.clock, "clock");
  exactKeys(clock, "clock", ["fps", "durationSeconds", "totalFrames"]);
  const fps = number(clock.fps, "clock.fps");
  const durationSeconds = number(clock.durationSeconds, "clock.durationSeconds");
  const totalFrames = number(clock.totalFrames, "clock.totalFrames");
  if (fps <= 0 || durationSeconds < 0 || !Number.isSafeInteger(totalFrames) || totalFrames < 1) {
    throw new MediaIRError("invalid_range", "clock values are invalid");
  }
  const retained = object(root.extensions, "extensions")["superimg.composition"];
  if (retained !== undefined) {
    const payload = object(object(retained, "extensions.superimg.composition").payload, "composition.payload");
    const schedule = object(payload.schedule, "composition.schedule");
    if (root.animated !== true || schedule.fps !== fps || schedule.totalFrames !== totalFrames ||
      durationSeconds !== totalFrames / fps) {
      throw new MediaIRError("clock_mismatch", "clock must match the retained composition schedule");
    }
  } else if (root.animated === true && totalFrames !== Math.max(1, Math.ceil(durationSeconds * fps))) {
    throw new MediaIRError(
      "clock_mismatch",
      "clock.totalFrames must equal ceil(durationSeconds * fps)",
    );
  }

  const capabilities = object(root.capabilities, "capabilities");
  exactKeys(capabilities, "capabilities", [
    "temporal",
    "motion",
    "visual",
    "portability",
    "determinism",
    "issues",
  ]);
  enumValue(capabilities.temporal, "capabilities.temporal", ["canonical", "sampled", "opaque"]);
  enumValue(capabilities.motion, "capabilities.motion", ["declarative", "sampled", "none"]);
  enumValue(capabilities.visual, "capabilities.visual", ["opaque-html", "opaque-svg", "tree"]);
  enumValue(capabilities.portability, "capabilities.portability", [
    "self-contained",
    "network-required",
    "incomplete",
  ]);
  enumValue(capabilities.determinism, "capabilities.determinism", ["verified", "unverified"]);
  array(capabilities.issues, "capabilities.issues").forEach((value, index) => {
    const path = `capabilities.issues[${index}]`;
    const issue = object(value, path);
    exactKeys(issue, path, ["code", "message", "sceneId", "id", "frame"]);
    string(issue.code, `${path}.code`);
    string(issue.message, `${path}.message`);
    if (issue.sceneId !== undefined) string(issue.sceneId, `${path}.sceneId`);
    if (issue.id !== undefined) string(issue.id, `${path}.id`);
    if (issue.frame !== undefined) {
      const frame = number(issue.frame, `${path}.frame`);
      if (!Number.isSafeInteger(frame) || frame < 0 || frame >= totalFrames) {
        throw new MediaIRError("invalid_range", `${path}.frame is outside the media clock`);
      }
    }
  });

  const provenance = object(root.provenance, "provenance");
  exactKeys(provenance, "provenance", ["programHash", "sourceId", "compiler", "compilerVersion"]);
  hash(provenance.programHash, "provenance.programHash");
  string(provenance.sourceId, "provenance.sourceId");
  if (provenance.compiler !== "superimg" || provenance.compilerVersion !== 0) {
    throw new MediaIRError("invalid_schema", "provenance compiler identity is invalid");
  }

  const scenes = array(root.scenes, "scenes");
  if (scenes.length === 0) {
    throw new MediaIRError("missing_field", "scenes must not be empty");
  }
  const transitionTargets: Array<{ path: string; fromSceneId: string; toSceneId: string }> = [];
  let sceneCursor = 0;
  const sceneIds = scenes.map((item, index) => {
    const path = `scenes[${index}]`;
    const scene = object(item, path);
    exactKeys(scene, path, ["id", "label", "index", "range", "phases", "markers", "transitions", "sourceId"]);
    const id = string(scene.id, `${path}.id`);
    if (scene.label !== undefined) string(scene.label, `${path}.label`);
    const sceneIndex = number(scene.index, `${path}.index`);
    if (sceneIndex !== index) {
      throw new MediaIRError("invalid_schema", `${path}.index must be ${index}`);
    }
    const sceneRange = range(scene.range, `${path}.range`, totalFrames);
    if (sceneRange.startFrame !== sceneCursor) {
      throw new MediaIRError("invalid_range", "scene ranges must be sorted and contiguous");
    }
    sceneCursor = sceneRange.endFrame;
    const phaseNames: string[] = [];
    array(scene.phases, `${path}.phases`).forEach((value, phaseIndex) => {
      const phasePath = `${path}.phases[${phaseIndex}]`;
      const phase = object(value, phasePath);
      exactKeys(phase, phasePath, ["name", "start", "end"]);
      phaseNames.push(string(phase.name, `${phasePath}.name`));
      const start = number(phase.start, `${phasePath}.start`);
      const end = number(phase.end, `${phasePath}.end`);
      if (start < 0 || end > 1 || start > end) {
        throw new MediaIRError(
          "invalid_range",
          `${path}.phases must be normalized inside [0, 1]`,
        );
      }
    });
    unique(phaseNames, `${path}.phases`);
    const markerIds: string[] = [];
    array(scene.markers, `${path}.markers`).forEach((value, markerIndex) => {
      const markerPath = `${path}.markers[${markerIndex}]`;
      const marker = object(value, markerPath);
      exactKeys(marker, markerPath, ["id", "label", "frame"]);
      markerIds.push(string(marker.id, `${markerPath}.id`));
      if (marker.label !== undefined) string(marker.label, `${markerPath}.label`);
      const frame = number(marker.frame, `${markerPath}.frame`);
      if (
        !Number.isSafeInteger(frame) ||
        frame < sceneRange.startFrame ||
        frame >= sceneRange.endFrame
      ) {
        throw new MediaIRError("invalid_range", `${markerPath}.frame must be inside its scene`);
      }
    });
    unique(markerIds, `${path}.markers`);
    const transitionIds: string[] = [];
    array(scene.transitions, `${path}.transitions`).forEach((value, transitionIndex) => {
      const transitionPath = `${path}.transitions[${transitionIndex}]`;
      const transition = object(value, transitionPath);
      exactKeys(transition, transitionPath, ["id", "type", "range", "fromSceneId", "toSceneId"]);
      transitionIds.push(string(transition.id, `${transitionPath}.id`));
      string(transition.type, `${transitionPath}.type`);
      range(transition.range, `${transitionPath}.range`, totalFrames);
      transitionTargets.push({
        path: transitionPath,
        fromSceneId: string(transition.fromSceneId, `${transitionPath}.fromSceneId`),
        toSceneId: string(transition.toSceneId, `${transitionPath}.toSceneId`),
      });
    });
    unique(transitionIds, `${path}.transitions`);
    if (scene.sourceId !== undefined && scene.sourceId !== null) {
      string(scene.sourceId, `${path}.sourceId`);
    }
    return id;
  });
  unique(sceneIds, "scenes");
  if (sceneCursor !== totalFrames) {
    throw new MediaIRError("invalid_range", "scene ranges must cover clock.totalFrames");
  }
  const knownScenes = new Set(sceneIds);
  for (const transition of transitionTargets) {
    if (!knownScenes.has(transition.fromSceneId) || !knownScenes.has(transition.toSceneId)) {
      throw new MediaIRError("unknown_target", `${transition.path} references an unknown scene`);
    }
  }

  for (const key of ["tracks", "motions"] as const) {
    const ids: string[] = [];
    array(root[key], key).forEach((item, index) => {
      const record = object(item, `${key}[${index}]`);
      exactKeys(
        record,
        `${key}[${index}]`,
        key === "tracks"
          ? ["id", "kind", "sceneId", "label", "range", "role", "src", "meta"]
          : [
              "id",
              "localId",
              "sceneId",
              "target",
              "property",
              "kind",
              "enter",
              "exit",
              "from",
              "to",
              "exitTo",
              "easing",
              "exitEasing",
              "pattern",
            ],
      );
      ids.push(string(record.id, `${key}[${index}].id`));
      const sceneId = string(record.sceneId, `${key}[${index}].sceneId`);
      if (!knownScenes.has(sceneId)) {
        throw new MediaIRError("unknown_target", `${key}[${index}] references unknown scene ${sceneId}`);
      }
      if (key === "tracks") {
        enumValue(record.kind, `${key}[${index}].kind`, [
          "audio",
          "transcript",
          "video-sync",
          "markers",
          "author-track",
        ]);
        if (record.label !== undefined) string(record.label, `${key}[${index}].label`);
        if (record.role !== undefined) string(record.role, `${key}[${index}].role`);
        if (record.src !== undefined) string(record.src, `${key}[${index}].src`);
        if (record.meta !== undefined) {
          json(object(record.meta, `${key}[${index}].meta`), `${key}[${index}].meta`);
        }
        range(record.range, `${key}[${index}].range`, totalFrames);
      }
      else {
        string(record.localId, `${key}[${index}].localId`);
        if (record.target !== undefined) string(record.target, `${key}[${index}].target`);
        if (record.property !== undefined) string(record.property, `${key}[${index}].property`);
        enumValue(record.kind, `${key}[${index}].kind`, ["motion", "tween", "value", "sampled"]);
        range(record.enter, `${key}[${index}].enter`, totalFrames);
        if (record.exit !== undefined) range(record.exit, `${key}[${index}].exit`, totalFrames);
        for (const field of ["from", "to", "exitTo"] as const) {
          if (record[field] !== undefined) {
            json(object(record[field], `${key}[${index}].${field}`), `${key}[${index}].${field}`);
          }
        }
        for (const field of ["easing", "exitEasing"] as const) {
          if (record[field] === undefined) continue;
          const easingPath = `${key}[${index}].${field}`;
          const easing = object(record[field], easingPath);
          const easingKind = enumValue(easing.kind, `${easingPath}.kind`, ["named", "spring"]);
          if (easingKind === "named") {
            exactKeys(easing, easingPath, ["kind", "name"]);
            string(easing.name, `${easingPath}.name`);
          } else {
            exactKeys(easing, easingPath, ["kind", "stiffness", "damping", "mass"]);
            number(easing.stiffness, `${easingPath}.stiffness`);
            number(easing.damping, `${easingPath}.damping`);
            if (easing.mass !== undefined) number(easing.mass, `${easingPath}.mass`);
          }
        }
        if (record.pattern !== undefined) {
          enumValue(record.pattern, `${key}[${index}].pattern`, ["linear", "sine", "pulse", "bounce"]);
        }
      }
    });
    unique(ids, key);
  }

  const assetIds: string[] = [];
  array(root.assets, "assets").forEach((value, index) => {
    const path = `assets[${index}]`;
    const asset = object(value, path);
    exactKeys(asset, path, ["id", "kind", "src", "remote", "contentHash"]);
    const assetId = string(asset.id, `${path}.id`);
    assetIds.push(assetId);
    enumValue(asset.kind, `${path}.kind`, ["image", "video", "audio", "font", "other"]);
    string(asset.src, `${path}.src`);
    boolean(asset.remote, `${path}.remote`);
    if (asset.contentHash !== undefined) hash(asset.contentHash, `${path}.contentHash`);
    if (asset.remote === false && asset.contentHash === undefined) {
      const hasMissingAssetIssue = array(capabilities.issues, "capabilities.issues").some(
        (issue) => object(issue, "capabilities issue").code === "missing_asset" &&
          object(issue, "capabilities issue").id === assetId,
      );
      if (!hasMissingAssetIssue) {
        throw new MediaIRError(
          "invalid_schema",
          `Local asset "${assetId}" needs contentHash or missing_asset issue`,
        );
      }
    }
  });
  unique(assetIds, "assets");
  const observations = object(root.observations, "observations");
  exactKeys(observations, "observations", ["markupRuns", "sceneRuns"]);
  for (const key of ["markupRuns", "sceneRuns"] as const) {
    runsCoverClock(observations[key], `observations.${key}`, totalFrames);
  }

  const hashes = object(root.hashes, "hashes");
  exactKeys(hashes, "hashes", ["intentHash", "markupHash", "programHash"]);
  hash(hashes.intentHash, "hashes.intentHash");
  hash(hashes.markupHash, "hashes.markupHash");
  const programHash = hash(hashes.programHash, "hashes.programHash");
  if (programHash !== provenance.programHash) {
    throw new MediaIRError(
      "invalid_schema",
      "provenance.programHash must equal hashes.programHash",
    );
  }

  const extensions = object(root.extensions, "extensions");
  for (const [name, value] of Object.entries(extensions)) {
    string(name, "extensions key");
    const envelope = object(value, `extensions.${name}`);
    exactKeys(envelope, `extensions.${name}`, ["schemaVersion", "payload"]);
    if (envelope.schemaVersion !== 0) {
      throw new MediaIRError("unknown_version", `extensions.${name}.schemaVersion must be 0`);
    }
    json(object(envelope.payload, `extensions.${name}.payload`), `extensions.${name}.payload`);
  }

  return value as MediaIR;
}
