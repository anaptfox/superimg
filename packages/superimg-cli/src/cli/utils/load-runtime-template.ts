//! Bundle + compile + resolve a template for runtime-true inspect/info.

import { dirname } from "node:path";
import { bundleTemplateWithMap } from "@superimg/core/bundler";
import {
  applyTemplateResolve,
  compileTemplate,
  parseDuration,
} from "@superimg/core";
import type { TemplateModule } from "@superimg/types";
import { findProjectRoot } from "./find-project-root.js";
import { loadCascadingConfig } from "./config-loader.js";
import { resolveRenderConfig } from "./template-config.js";

export interface RuntimeTemplateConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
}

export interface LoadedRuntimeTemplate {
  template: TemplateModule;
  path: string;
  config: RuntimeTemplateConfig;
  data: Record<string, unknown>;
}

/**
 * Load a template the same way render does (bundle + compile + applyTemplateResolve),
 * preferring executed `template.config` over AST-only metadata.
 */
export async function loadRuntimeTemplate(
  resolvedPath: string,
  options: { data?: Record<string, unknown> } = {},
): Promise<LoadedRuntimeTemplate> {
  const templateBundle = await bundleTemplateWithMap(resolvedPath);
  const compiled = compileTemplate(templateBundle.code);
  if (compiled.error || !compiled.template) {
    throw compiled.error ?? new Error("Template compilation failed");
  }

  let projectRoot: string | undefined;
  try {
    projectRoot = findProjectRoot();
  } catch {
    projectRoot = dirname(resolvedPath);
  }
  const cascadingConfig = await loadCascadingConfig(resolvedPath, projectRoot);

  const applied = await applyTemplateResolve(compiled.template, {
    ...(options.data !== undefined ? { data: options.data } : {}),
  });
  const template = applied.template;

  const runtimeCfg = template.config ?? {};
  const cascading = cascadingConfig ?? {};

  const fps =
    (typeof runtimeCfg.fps === "number" ? runtimeCfg.fps : undefined) ??
    cascading.fps ??
    30;

  let durationSeconds: number;
  if (typeof runtimeCfg.duration === "number") {
    durationSeconds = runtimeCfg.duration;
  } else if (runtimeCfg.duration != null) {
    durationSeconds = parseDuration(runtimeCfg.duration, "duration", fps);
  } else if (typeof cascading.duration === "number") {
    durationSeconds = cascading.duration;
  } else {
    // Match resolveRenderConfig default when nothing is set
    const fallback = resolveRenderConfig({
      templateConfig: runtimeCfg as Parameters<typeof resolveRenderConfig>[0]["templateConfig"],
      cascadingConfig: cascading,
    });
    durationSeconds = fallback.duration;
  }

  const width =
    (typeof runtimeCfg.width === "number" ? runtimeCfg.width : undefined) ??
    cascading.width ??
    1920;
  const height =
    (typeof runtimeCfg.height === "number" ? runtimeCfg.height : undefined) ??
    cascading.height ??
    1080;

  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

  return {
    template,
    path: resolvedPath,
    config: {
      width,
      height,
      fps,
      duration: durationSeconds,
      totalFrames,
    },
    data: applied.data,
  };
}
