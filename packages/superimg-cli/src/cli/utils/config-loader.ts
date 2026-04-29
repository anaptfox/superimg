//! Load and merge cascading _config.ts files from video path up to project root

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createSuperimgPlugin } from "@superimg/core/bundler-plugin";
import type { ProjectConfig } from "@superimg/types";
import { mergeBaseConfig } from "./merge-base-config.js";

/**
 * Walks up from the video file's directory to the project root,
 * collecting and merging _config.ts files.
 *
 * Merge strategy:
 * - Scalar fields (width, height, fps, duration): nearest wins
 * - Arrays (fonts, inlineCss, stylesheets): concatenate root first, then more specific
 * - outputs: nearest wins (object merge could be complex, keep simple)
 */
export async function loadCascadingConfig(
  videoPath: string,
  projectRoot: string
): Promise<ProjectConfig> {
  const configs: string[] = [];
  let dir = dirname(videoPath);
  const root = join(projectRoot);

  while (dir && (dir.length >= root.length || dir === root)) {
    const configPath = join(dir, "_config.ts");
    if (existsSync(configPath)) {
      configs.push(configPath);
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
  for (const configPath of configs) {
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
      if (!raw || typeof raw !== "object") {
        throw new Error(
          `Invalid _config.ts at ${configPath}: expected an object, got ${typeof raw}`
        );
      }
      return raw as ProjectConfig;
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
  return configs.reduce<ProjectConfig>(
    (acc, curr) => mergeBaseConfig<ProjectConfig>(acc, curr),
    {}
  );
}
