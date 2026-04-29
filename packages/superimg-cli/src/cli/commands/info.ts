//! Info command - show template metadata

import { resolveTemplatePath } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import { parseTemplate, resolveRenderConfig } from "../utils/template-config.js";

export async function infoCommand(template: string) {
  let resolvedPath: string;
  try {
    resolvedPath = resolveTemplatePath(template);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  const cascadingConfig = await loadCascadingConfig(resolvedPath, projectRoot);

  let templateData!: Awaited<ReturnType<typeof parseTemplate>>;
  try {
    templateData = await parseTemplate(resolvedPath, { cascadingConfig });
  } catch (err) {
    console.error(`Error parsing template: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const resolvedConfig = resolveRenderConfig({
    templateConfig: templateData.templateConfig,
    cascadingConfig,
  });
  const { fps } = resolvedConfig;
  const totalFrames = Math.ceil(resolvedConfig.duration * fps);
  const duration = resolvedConfig.duration;

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
