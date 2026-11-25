import { dirname } from "node:path";
import {
  loadNodeMediaValue,
  compileNodeMediaSource,
  type CompiledNodeMediaSource,
  type LoadedNodeMediaValue,
  type LoadNodeMediaValueOptions,
} from "@foxworth/superimg-node/source";
import type {
  CollectionDefinition,
  DeterministicMediaDefinition,
  JsonObject,
  MediaValue,
} from "@superimg/types";
import { findProjectRoot } from "./find-project-root.js";
import { loadCascadingConfig } from "./config-loader.js";
import { mergeCascadingIntoRenderConfig } from "./template-config.js";
import { profileStage } from "./command-profile.js";

export interface LoadedCliMediaValue extends LoadedNodeMediaValue {
  readonly value: MediaValue;
}

/** Compile once before description/provider classification for one CLI command. */
export async function prepareCliMediaSource(resolvedPath: string): Promise<CompiledNodeMediaSource> {
  return profileStage("source.load", () => compileNodeMediaSource(findProjectRoot(dirname(resolvedPath)), resolvedPath, { measureStage: profileStage }));
}

/**
 * Host-owned source loading for CLI semantic commands. Native source identity,
 * provider policy, and cascading config stop here; only `value` enters Runtime.
 */
export async function loadCliMediaValue(
  resolvedPath: string,
  options: LoadNodeMediaValueOptions = {},
): Promise<LoadedCliMediaValue> {
  const projectRoot = findProjectRoot(dirname(resolvedPath));
  const loaded = await profileStage("source.materialize", () => loadNodeMediaValue(projectRoot, resolvedPath, { ...options, measureStage: options.measureStage ?? profileStage }));
  if (loaded.value.kind === "interactive") return loaded;

  const cascading = await profileStage("source.configuration", () => loadCascadingConfig(resolvedPath, projectRoot));
  const value = withCascadingConfig(loaded.value, cascading);
  return Object.freeze({ ...loaded, value });
}

function withCascadingConfig(
  value: Exclude<MediaValue, { readonly kind: "interactive" }>,
  cascading: Parameters<typeof mergeCascadingIntoRenderConfig>[1],
): Exclude<MediaValue, { readonly kind: "interactive" }> {
  if (value.kind === "collection") {
    return Object.freeze({
      ...value,
      media: withMediaConfig(value.media, cascading),
    }) as CollectionDefinition<JsonObject, DeterministicMediaDefinition<JsonObject>>;
  }
  return withMediaConfig(value, cascading);
}

function withMediaConfig(
  media: DeterministicMediaDefinition<JsonObject>,
  cascading: Parameters<typeof mergeCascadingIntoRenderConfig>[1],
): DeterministicMediaDefinition<JsonObject> {
  return Object.freeze({
    ...media,
    config: Object.freeze(
      mergeCascadingIntoRenderConfig(media.config, cascading),
    ),
  });
}
