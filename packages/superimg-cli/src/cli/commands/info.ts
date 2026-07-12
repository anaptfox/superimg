//! Info command - show template metadata (runtime-true when load succeeds)

import { resolveTemplatePath } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import { parseTemplate, resolveRenderConfig } from "../utils/template-config.js";
import { loadRuntimeTemplate } from "../utils/load-runtime-template.js";
import { probeDirectorPhases } from "@superimg/core/testing";

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

  // Prefer runtime load (executed config + optional phases)
  try {
    const loaded = await loadRuntimeTemplate(resolvedPath);
    const { config, template: mod, data } = loaded;
    const rawPhases = probeDirectorPhases(mod, {
      fps: config.fps,
      durationSeconds: config.duration,
      width: config.width,
      height: config.height,
      data,
    });
    const phases = rawPhases?.map((p) => ({
      name: p.name,
      start: p.start,
      end: p.end,
      startSec: p.start * config.duration,
      endSec: p.end * config.duration,
    })) ?? null;

    if (options.json) {
      console.log(JSON.stringify({
        path: resolvedPath,
        source: "runtime",
        config: {
          width: config.width,
          height: config.height,
          fps: config.fps,
          duration: config.duration,
        },
        totalFrames: config.totalFrames,
        duration: config.duration,
        phases,
      }, null, 2));
      return;
    }

    console.log("\n  Template Information");
    console.log("  ===================\n");
    console.log(`  File: ${resolvedPath}`);
    console.log(`  Status: ✓ Loaded (runtime)\n`);
    console.log("  Configuration:");
    console.log(`    Width: ${config.width}px`);
    console.log(`    Height: ${config.height}px`);
    console.log(`    FPS: ${config.fps}`);
    console.log(`    Duration: ${config.duration}s (runtime)`);
    console.log();
    console.log("  Video:");
    console.log(`    Total frames: ${config.totalFrames}`);
    console.log(`    Duration: ${config.duration.toFixed(2)}s (at ${config.fps} fps)`);
    if (phases && phases.length > 0) {
      console.log("\n  Director phases:");
      for (const p of phases) {
        console.log(
          `    ${p.name}: ${p.startSec.toFixed(2)}s–${p.endSec.toFixed(2)}s (${(p.start * 100).toFixed(0)}–${(p.end * 100).toFixed(0)}%)`,
        );
      }
    }
    console.log("\n");
    return;
  } catch {
    // Fall back to AST path (const-folded after Workstream A)
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
    ...(templateData.templateConfig !== undefined
      ? { templateConfig: templateData.templateConfig }
      : {}),
    cascadingConfig,
  });
  const { fps } = resolvedConfig;
  const totalFrames = Math.ceil(resolvedConfig.duration * fps);
  const duration = resolvedConfig.duration;

  if (options.json) {
    console.log(JSON.stringify({
      path: resolvedPath,
      source: "ast",
      config: resolvedConfig,
      totalFrames,
      duration,
    }, null, 2));
    return;
  }

  console.log("\n  Template Information");
  console.log("  ===================\n");
  console.log(`  File: ${resolvedPath}`);
  console.log(`  Status: ✓ Compiled successfully (AST)\n`);

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
