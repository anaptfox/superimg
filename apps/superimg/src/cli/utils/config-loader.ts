//! Load and merge cascading _config.ts files from video path up to project root

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createSuperimgPlugin } from "@superimg/core/bundler-plugin";
import type { ProjectConfig } from "@superimg/types";
import { ProjectConfigSchema } from "@superimg/types";

/**
 * Walks up from the video file's directory to the project root,
 * collecting and merging _config.ts files.
 *
 * Merge strategy:
 * - Scalar fields (width, height, fps, durationSeconds): nearest wins
 * - Arrays (fonts, inlineCss, stylesheets): concatenate root first, then more specific
 * - outputs: nearest wins (object merge could be complex, keep simple)
 */
export async function loadCascadingConfig(
  videoPath: string,
  projectRoot: string
): Promise<ProjectConfig> {
  const configs: { path: string; dir: string }[] = [];
  let dir = dirname(videoPath);
  const root = join(projectRoot);

  while (dir && (dir.length >= root.length || dir === root)) {
    const configPath = join(dir, "_config.ts");
    if (existsSync(configPath)) {
      configs.push({ path: configPath, dir });
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (configs.length === 0) {
    return {};
  }

  // configs: [nearest to video, ..., root] - reverse to get [root, ..., nearest]
  // Merge so root first, then child, so nearest wins for scalars
  configs.reverse();

  const loaded: ProjectConfig[] = [];
  for (const { path: configPath } of configs) {
    const config = await loadSingleConfig(configPath);
    if (config && Object.keys(config).length > 0) {
      loaded.push(config);
    }
  }

  return mergeConfigs(loaded);
}

async function loadSingleConfig(configPath: string): Promise<ProjectConfig | null> {
  try {
    const result = await esbuild.build({
      entryPoints: [configPath],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      target: "es2020",
      plugins: [createSuperimgPlugin()],
    });

    const code = result.outputFiles[0]?.text;
    if (!code) return null;

    const tmpDir = mkdtempSync(join(tmpdir(), "superimg-config-"));
    const tmpFile = join(tmpDir, "config.mjs");
    writeFileSync(tmpFile, code);

    try {
      const mod = await import(pathToFileURL(tmpFile).href);
      const raw = mod.default ?? mod;
      const parsed = ProjectConfigSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `Invalid _config.ts at ${configPath}: ${parsed.error.message}`
        );
      }
      return parsed.data as ProjectConfig;
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  } catch (err) {
    // Rethrow validation errors so they surface to the user
    if (err instanceof Error && err.message.includes("Invalid _config.ts")) {
      throw err;
    }
    return null;
  }
}

function mergeConfigs(configs: ProjectConfig[]): ProjectConfig {
  const merged: ProjectConfig = {};

  for (const config of configs) {
    // Scalars: overwrite
    if (config.width !== undefined) merged.width = config.width;
    if (config.height !== undefined) merged.height = config.height;
    if (config.fps !== undefined) merged.fps = config.fps;
    if (config.durationSeconds !== undefined) merged.durationSeconds = config.durationSeconds;
    if (config.outputs !== undefined) merged.outputs = config.outputs;

    // Arrays: concatenate (parent first, then child)
    if (config.fonts?.length) {
      merged.fonts = [...(merged.fonts ?? []), ...config.fonts];
    }
    if (config.inlineCss?.length) {
      merged.inlineCss = [...(merged.inlineCss ?? []), ...config.inlineCss];
    }
    if (config.stylesheets?.length) {
      merged.stylesheets = [...(merged.stylesheets ?? []), ...config.stylesheets];
    }
  }

  return merged;
}
