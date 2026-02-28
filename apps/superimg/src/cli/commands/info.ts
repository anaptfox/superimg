//! Info command - show template metadata

import { resolve } from "node:path";
import { parseTemplate, resolveRenderConfig } from "../utils/template-config.js";

export async function infoCommand(template: string) {
  let templateData!: Awaited<ReturnType<typeof parseTemplate>>;
  try {
    templateData = await parseTemplate(template);
  } catch (err) {
    console.error(`Error parsing template: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const templatePath = resolve(template);
  const resolvedConfig = resolveRenderConfig({
    templateConfig: templateData.templateConfig,
  });
  const { fps } = resolvedConfig;
  const totalFrames = Math.ceil(resolvedConfig.durationSeconds * fps);
  const durationSeconds = resolvedConfig.durationSeconds;

  console.log("\n  Template Information");
  console.log("  ===================\n");
  console.log(`  File: ${templatePath}`);
  console.log(`  Status: ✓ Compiled successfully\n`);

  if (templateData.templateConfig) {
    console.log("  Configuration:");
    if (resolvedConfig.width) console.log(`    Width: ${resolvedConfig.width}px`);
    if (resolvedConfig.height) console.log(`    Height: ${resolvedConfig.height}px`);
    if (resolvedConfig.fps) console.log(`    FPS: ${resolvedConfig.fps}`);
    if (resolvedConfig.durationSeconds) console.log(`    Duration: ${resolvedConfig.durationSeconds}s`);
    console.log();
  }

  console.log("  Video:");
  console.log(`    Total frames: ${totalFrames}`);
  console.log(`    Duration: ${durationSeconds.toFixed(2)}s (at ${fps} fps)`);

  console.log("\n");
}
