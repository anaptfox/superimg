//! Render command — thin CLI orchestrator over render-targets + render-execute.
//!
//! - `renderCommand` is the entry point. It owns the Playwright availability
//!   check and exit codes, then dispatches to either single-template or
//!   --all flows.
//! - Single-template TTY runs use the `RenderUI` Ink component below.
//! - Single-template non-TTY runs and the entire --all flow use plain
//!   console output via `executeRenderTargets` directly.

import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { PlaywrightEngine } from "@superimg/node/internal";
import { formatError } from "@superimg/core/errors";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import { discoverVideos, type DiscoveredVideo } from "../utils/discover-videos.js";
import { parseTemplate } from "../utils/template-config.js";
import { resolveOutputPath } from "../utils/resolve-output-path.js";
import { resolveFormat, type OutputFormat } from "./render-encoding.js";
import {
  resolveRenderTargets,
  type RenderOptions,
  type RenderTarget,
  type ResolvedTargets,
} from "./render-targets.js";
import { executeRenderTargets } from "./render-execute.js";

export type { RenderOptions } from "./render-targets.js";

/** Check if path is a directory (exists and is dir, or ends with /). */
function isDirectory(path: string): boolean {
  if (path.endsWith("/")) return true;
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

async function checkPlaywrightAvailable(): Promise<{ available: boolean; message?: string }> {
  const status = await PlaywrightEngine.checkBrowser();
  if (!status.installed) {
    return {
      available: false,
      message: "Playwright browsers not installed. Run 'superimg setup' first.",
    };
  }
  return { available: true };
}

export async function renderCommand(template: string, options: RenderOptions) {
  const pwCheck = await checkPlaywrightAvailable();
  if (!pwCheck.available) {
    if (options.json) {
      console.log(JSON.stringify({ error: { message: pwCheck.message, code: "PLAYWRIGHT_NOT_INSTALLED" } }));
      process.exit(1);
    }
    console.error(`\nError: ${pwCheck.message}\n`);
    console.error("To render videos locally, you need to install Playwright browsers:");
    console.error("  superimg setup\n");
    console.error("Or use the dev server to preview and export from browser:");
    console.error("  superimg dev template.ts\n");
    process.exit(1);
  }

  const outputFormat = resolveFormat(options);

  if (options.all && options.data) {
    if (options.json) {
      console.log(JSON.stringify({ error: { message: "--all and --data cannot be combined.", code: "INVALID_OPTIONS" } }));
      process.exit(1);
    }
    console.error(
      "Error: --all and --data cannot be combined. --all selects N templates; --data selects N data entries for one template.",
    );
    process.exit(1);
  }

  if (options.all) {
    const projectRoot = findProjectRoot();
    const videos = discoverVideos(projectRoot);
    if (videos.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ error: { message: "No *.media.ts files found in project.", code: "NO_TEMPLATES_FOUND" } }));
        process.exit(1);
      }
      console.error("Error: No *.media.ts files found in project.");
      process.exit(1);
    }
    if (options.dryRun) {
      if (options.json) {
        console.log(JSON.stringify({ videos: videos.map(v => ({ name: v.name, path: v.relativePath })) }, null, 2));
        return;
      }
      console.log(`\nDry run — ${videos.length} video(s) found:\n`);
      for (const v of videos) console.log(`  - ${v.name} (${v.relativePath})`);
      console.log("\nNo renders executed.\n");
      return;
    }
    return runRenderAll(videos, options, outputFormat, projectRoot);
  }

  // Single-template path: resolve targets up front, then dispatch to TTY/non-TTY.
  let resolved: ResolvedTargets;
  try {
    resolved = await resolveRenderTargets(template, options, outputFormat);
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    process.stderr.write(formatted.ansi + "\n");
    process.exit(1);
  }

  if (options.dryRun) {
    const { targets } = resolved;
    if (options.json) {
      console.log(JSON.stringify({ targets }, null, 2));
      return;
    }
    console.log(`\nDry run — ${targets.length} render target(s):\n`);
    for (const t of targets) console.log(`  - ${t.outputPath}  (${t.width}x${t.height} ${t.fps}fps)`);
    console.log("\nNo renders executed.\n");
    return;
  }

  if (process.stdout.isTTY && !options.json) {
    const { renderWithInkUI } = await import("./render-ui.js");
    renderWithInkUI(resolved, options);
    return;
  }

  // Non-TTY: plain console progress, throws caught and exit(1).
  try {
    await runRenderTargetsPlain(resolved, options);
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ event: "error", error: formatted.json }));
      process.exit(1);
    }
    process.stderr.write("\n" + formatted.ansi + "\n");
    process.exit(1);
  }
}

/** Per-target progress + completion logging for non-TTY single-template runs. */
async function runRenderTargetsPlain(resolved: ResolvedTargets, options: RenderOptions) {
  const total = resolved.targets.length;
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  const timeoutSeconds = Number(options.timeout);
  try {
    await executeRenderTargets({
      resolved,
      options,
      signal: controller.signal,
      ...(Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
        ? { deadlineMs: Date.now() + timeoutSeconds * 1_000 }
        : {}),
    onTargetStart: (target, index) => {
      if (options.json) {
        console.log(JSON.stringify({ event: "start", target: target.name, outputPath: target.outputPath }));
        return;
      }
      const prefix = total > 1 ? `[${index + 1}/${total}] ` : "";
      const label = target.entryLabel ? `${target.entryLabel} (${target.name}) — ` : "";
      console.log(`${prefix}${label}Rendering ${target.outputPath}...`);
      if (options.debugHtml) {
        console.log(`${prefix}Debug HTML: ${target.debugHtmlDir}`);
      }
    },
    onProgress: (_target, p) => {
      if (options.json) {
        console.log(JSON.stringify({ event: "progress", target: _target.name, frame: p.frame, totalFrames: p.totalFrames }));
        return;
      }
      process.stdout.write(
        `\r  Frame ${p.frame}/${p.totalFrames} (${Math.round((p.frame / p.totalFrames) * 100)}%)`
      );
    },
    onTargetComplete: (target) => {
      if (options.json) {
        console.log(JSON.stringify({ event: "complete", target: target.name, outputPath: target.outputPath }));
        return;
      }
      process.stdout.write("\n");
      console.log(`  Saved to ${target.outputPath}`);
    },
    });
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}

/**
 * --all orchestrator. For each discovered video:
 *   - Pre-flight parse to detect declared `outputs:` (so we render every preset).
 *   - try { resolveRenderTargets → executeRenderTargets } catch { record + skip }.
 * After the loop: print summary, exit 0/1.
 */
async function runRenderAll(
  videos: DiscoveredVideo[],
  options: RenderOptions,
  outputFormat: OutputFormat,
  projectRoot: string,
) {
  if (!options.json) {
    console.log(`Found ${videos.length} video(s) to render:\n`);
    for (const video of videos) {
      console.log(`  - ${video.name} (${video.relativePath})`);
    }
    console.log("");
  }

  const failures: { name: string; relativePath: string; error: unknown }[] = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    if (!video) continue;
    if (!options.json) {
      console.log(`\n[${i + 1}/${videos.length}] ${video.name}`);
    }

    const cliOutput = options.output
      ? (isDirectory(options.output) ? options.output : dirname(options.output) + "/")
      : undefined;
    const videoOutput = resolveOutputPath({
      ...(cliOutput !== undefined ? { outputArg: cliOutput } : {}),
      templatePath: video.entrypoint,
      ...(outputFormat !== undefined ? { format: outputFormat } : {}),
    });

    let hasOutputs = false;
    try {
      const cascading = await loadCascadingConfig(video.entrypoint, projectRoot);
      const parsed = await parseTemplate(video.entrypoint, { cascadingConfig: cascading });
      const declared = parsed.templateConfig?.outputs;
      hasOutputs = !!declared && Object.keys(declared).length > 0;
    } catch (err) {
      const formatted = formatError(err);
      if (options.json) {
        console.log(JSON.stringify({ event: "error", video: video.name, error: formatted.json }));
      } else {
        console.error(`  ✗ ${video.name}: ${formatted.plain}`);
      }
      if (options.failOnError) {
        if (!options.json) console.error("\nAborting: --fail-on-error is set.\n");
        process.exit(1);
      }
      failures.push({ name: video.name, relativePath: video.relativePath, error: formatted.json });
      continue;
    }

    const perVideoOptions: RenderOptions = {
      ...options,
      all: false,
      output: videoOutput,
      presets: options.presets || hasOutputs,
    };

    try {
      const resolved = await resolveRenderTargets(video.entrypoint, perVideoOptions, outputFormat);
      await runRenderTargetsPlain(resolved, perVideoOptions);
    } catch (err) {
      const formatted = formatError(err);
      if (options.json) {
        console.log(JSON.stringify({ event: "error", video: video.name, error: formatted.json }));
      } else {
        console.error(`  ✗ ${video.name}: ${formatted.plain}`);
      }
      if (options.failOnError) {
        if (!options.json) console.error("\nAborting: --fail-on-error is set.\n");
        process.exit(1);
      }
      failures.push({ name: video.name, relativePath: video.relativePath, error: formatted.json });
    }
  }

  const total = videos.length;
  const failed = failures.length;
  const succeeded = total - failed;
  
  if (options.json) {
    console.log(JSON.stringify({ event: "all_complete", total, succeeded, failed, failures }));
    if (failed > 0) process.exit(1);
    return;
  }

  console.log("");
  if (failed === 0) {
    console.log(`✓ Rendered ${total}/${total} video(s)`);
    return;
  }
  console.log(`Rendered ${succeeded}/${total} video(s); ${failed} failed:`);
  for (const f of failures) {
    console.log(`  - ${f.name} (${f.relativePath})`);
  }
  process.exit(1);
}
