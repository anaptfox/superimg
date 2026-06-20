//! Info command - show template metadata

import { resolveTemplatePath } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import { parseTemplate, resolveRenderConfig } from "../utils/template-config.js";

import { formatError } from "@superimg/core/errors";

export async function infoCommand(template: string, options: { json?: boolean } = {}) {
  let resolvedPath: string;
  try {
    resolvedPath = resolveTemplatePath(template);
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`Error: ${formatted.plain}`);
    process.exit(1);
  }

  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`Error: ${formatted.plain}`);
    process.exit(1);
  }
  const cascadingConfig = await loadCascadingConfig(resolvedPath, projectRoot);

  let templateData!: Awaited<ReturnType<typeof parseTemplate>>;
  try {
    templateData = await parseTemplate(resolvedPath, { cascadingConfig });
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`Error parsing template: ${formatted.plain}`);
    process.exit(1);
  }

  const resolvedConfig = resolveRenderConfig({
    templateConfig: templateData.templateConfig,
    cascadingConfig,
  });
  const { fps } = resolvedConfig;
  const totalFrames = Math.ceil(resolvedConfig.duration * fps);
  const duration = resolvedConfig.duration;

  if (options.json) {
    console.log(JSON.stringify({
      path: resolvedPath,
      config: resolvedConfig,
      totalFrames,
      duration,
    }, null, 2));
    return;
  }

  console.log("\n  Template Information");
  console.log("  ===================\n");
  console.log(`  File: ${resolvedPath}`);
  console.log(`  Status: ✓ Compiled successfully\n`);

  if (templateData.templateConfig) {
    console.log("  Configuration:");
    if (resolvedConfig.width) console.log(`    Width: ${resolvedConfig.width}px`);
    if (resolvedConfig.height) console.log(`    Height: ${resolvedConfig.height}px`);
    if (resolvedConfig.fps) console.log(`    FPS: ${resolvedConfig.fps}`);
    if (resolvedConfig.duration) console.log(`    Duration: ${resolvedConfig.duration}s`);
    console.log();
  }

  console.log("  Video:");
  console.log(`    Total frames: ${totalFrames}`);
  console.log(`    Duration: ${duration.toFixed(2)}s (at ${fps} fps)`);

  console.log("\n");
}
