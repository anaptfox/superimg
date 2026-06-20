//! Render command — thin CLI orchestrator over render-targets + render-execute.
//!
//! - `renderCommand` is the entry point. It owns the Playwright availability
//!   check and exit codes, then dispatches to either single-template or
//!   --all flows.
//! - Single-template TTY runs use the `RenderUI` Ink component below.
//! - Single-template non-TTY runs and the entire --all flow use plain
//!   console output via `executeRenderTargets` directly.

import { render, Box, Text } from "ink";
import { useState, useEffect } from "react";
import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { RenderProgress } from "@superimg/types";
import { PlaywrightEngine } from "@superimg/playwright";
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
        console.log(JSON.stringify({ error: { message: "No *.video.ts files found in project.", code: "NO_VIDEOS_FOUND" } }));
        process.exit(1);
      }
      console.error("Error: No *.video.ts files found in project.");
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
    render(<RenderUI resolved={resolved} options={options} />);
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
  await executeRenderTargets({
    resolved,
    options,
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
    if (!options.json) {
      console.log(`\n[${i + 1}/${videos.length}] ${video.name}`);
    }

    const cliOutput = options.output
      ? (isDirectory(options.output) ? options.output : dirname(options.output) + "/")
      : undefined;
    const videoOutput = resolveOutputPath({
      outputArg: cliOutput,
      templatePath: video.entrypoint,
      format: outputFormat,
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

/** Ink UI for single-template TTY runs. */
function RenderUI({ resolved, options }: { resolved: ResolvedTargets; options: RenderOptions }) {
  const { targets, resolvedConfig } = resolved;
  const [progress, setProgress] = useState<RenderProgress>({
    frame: 0,
    totalFrames: 1,
    fps: resolvedConfig.fps,
  });
  const [currentTarget, setCurrentTarget] = useState(0);
  const [status, setStatus] = useState("Initializing Playwright...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setStatus(targets.length > 1 ? "Rendering..." : "Bundling template...");
        await executeRenderTargets({
          resolved,
          options,
          isCancelled: () => !mounted,
          onTargetStart: (_target, index, total) => {
            if (!mounted) return;
            setCurrentTarget(index);
            setStatus(total > 1
              ? `Rendering "${_target.name}" (${index + 1}/${total})...`
              : "Rendering...");
          },
          onProgress: (_target, p) => {
            if (mounted) setProgress(p);
          },
        });

        if (!mounted) return;
        if (targets.length > 1) {
          const paths = targets.map((t) => t.outputPath).join("\n  ");
          setStatus(`Complete! Saved:\n  ${paths}`);
        } else {
          setStatus(`Complete! Saved to ${targets[0].outputPath}`);
        }
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        if (!mounted) return;
        // Render only inside Ink's <Text>; writing the same block to stderr
        // would duplicate output for piped consumers and risks corrupting
        // Ink's terminal control sequences.
        setError(formatError(err).plain);
        setStatus("Error");
        setTimeout(() => process.exit(1), 2000);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const pct = Math.round((progress.frame / progress.totalFrames) * 100);
  const target = targets[currentTarget];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        SuperImg Render
      </Text>
      <Box marginTop={1}>
        <Text>{status}</Text>
      </Box>
      {error ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{error}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text>
            Frame: <Text color="cyan">{progress.frame}/{progress.totalFrames}</Text>
            {" "}(<Text color="yellow">{pct}%</Text>)
            {" "}<Text dimColor>{target.width}x{target.height}</Text>
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Output: {target.outputPath}</Text>
      </Box>
      {options.debugHtml ? (
        <Box marginTop={1}>
          <Text dimColor>Debug HTML: {target.debugHtmlDir}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
