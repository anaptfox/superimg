//! Render command with Ink UI

import { render, Box, Text } from "ink";
import { useState, useEffect } from "react";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import type { RenderJob, RenderProgress, TimeContext } from "@superimg/types";
import { TemplateRuntimeError } from "@superimg/types";
import { PlaywrightEngine } from "@superimg/playwright";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { bundleTemplateCode } from "@superimg/core/bundler";
import { parseTemplate, resolveRenderConfig, resolvePresetConfig, resolveAllPresets } from "../utils/template-config.js";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import type { EncodingOptions } from "@superimg/types";

interface RenderOptions {
  output: string;
  format?: string;
  width?: string;
  height?: string;
  fps?: string;
  preset?: string;
  all?: boolean;
  quality?: string;
  videoCodec?: string;
  videoBitrate?: string;
  audioCodec?: string;
  audioBitrate?: string;
  keyframeInterval?: string;
}

function resolveFormat(opts: RenderOptions): "mp4" | "webm" | undefined {
  if (opts.format) {
    const f = opts.format.toLowerCase();
    if (f === "mp4" || f === "webm") return f;
    console.warn(`Warning: Unknown format "${opts.format}". Valid: mp4, webm. Using default.`);
    return undefined;
  }
  // Auto-detect from output file extension
  if (opts.output.endsWith(".webm")) return "webm";
  return undefined;
}

function buildEncodingOptions(opts: RenderOptions): EncodingOptions | undefined {
  const format = resolveFormat(opts);
  const hasEncoding =
    format ||
    opts.quality ||
    opts.videoCodec ||
    opts.videoBitrate ||
    opts.audioCodec ||
    opts.audioBitrate ||
    opts.keyframeInterval;

  if (!hasEncoding) return undefined;

  const encoding: EncodingOptions = {};
  if (format) encoding.format = format;
  const validVideoCodecs = ["avc", "vp9", "av1"];
  const validAudioCodecs = ["aac", "opus"];
  const validQuality = ["very-low", "low", "medium", "high", "very-high"];

  if (opts.quality || opts.videoCodec || opts.videoBitrate || opts.keyframeInterval) {
    encoding.video = {};
    if (opts.videoCodec) {
      const codec = opts.videoCodec.toLowerCase();
      if (validVideoCodecs.includes(codec)) {
        encoding.video.codec = codec as "avc" | "vp9" | "av1";
      } else {
        console.warn(`Warning: Unknown video codec "${opts.videoCodec}". Valid: ${validVideoCodecs.join(", ")}. Using default.`);
      }
    }
    if (opts.videoBitrate) {
      const bps = parseInt(opts.videoBitrate, 10);
      if (!isNaN(bps)) encoding.video.bitrate = bps;
    } else if (opts.quality) {
      if (validQuality.includes(opts.quality)) {
        encoding.video.bitrate = opts.quality as "very-low" | "low" | "medium" | "high" | "very-high";
      } else {
        console.warn(`Warning: Unknown quality "${opts.quality}". Valid: ${validQuality.join(", ")}. Using default.`);
      }
    }
    if (opts.keyframeInterval) {
      const sec = parseFloat(opts.keyframeInterval);
      if (!isNaN(sec)) encoding.video.keyFrameInterval = sec;
    }
  }

  if (opts.audioCodec || opts.audioBitrate) {
    encoding.audio = {};
    if (opts.audioCodec) {
      const codec = opts.audioCodec.toLowerCase();
      if (validAudioCodecs.includes(codec)) {
        encoding.audio.codec = codec as "aac" | "opus";
      } else {
        console.warn(`Warning: Unknown audio codec "${opts.audioCodec}". Valid: ${validAudioCodecs.join(", ")}. Using default.`);
      }
    }
    if (opts.audioBitrate) {
      const bps = parseInt(opts.audioBitrate, 10);
      if (!isNaN(bps)) encoding.audio.bitrate = bps;
    }
  }

  // Apply WebM smart defaults when no explicit video options were set
  if (format === "webm") {
    if (!encoding.video) encoding.video = {};
    if (!encoding.video.codec) encoding.video.codec = ["vp9", "av1"];
    if (!encoding.video.alpha) encoding.video.alpha = "keep";
  }

  return encoding;
}

interface RenderTarget {
  name: string;
  width: number;
  height: number;
  fps: number;
  outputPath: string;
  outputName: string;
}

function splitFilename(filepath: string): { base: string; ext: string } {
  const dot = filepath.lastIndexOf(".");
  if (dot <= 0) return { base: filepath, ext: "" };
  return { base: filepath.slice(0, dot), ext: filepath.slice(dot) };
}

async function checkPlaywrightAvailable(): Promise<{ available: boolean; message?: string; isServerless?: boolean }> {
  // Check for serverless environment
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );

  if (isServerless) {
    try {
      await import("@sparticuz/chromium");
      return { available: true, isServerless: true };
    } catch {
      return {
        available: false,
        isServerless: true,
        message: "For Vercel/serverless, install: pnpm add @sparticuz/chromium",
      };
    }
  }

  // Local environment - check for regular Playwright
  try {
    const { chromium } = await import("playwright");
    // Try to get executable path - this throws if browsers not installed
    chromium.executablePath();
    return { available: true };
  } catch {
    return {
      available: false,
      message: "Playwright browsers not installed. Run 'superimg setup' first.",
    };
  }
}

export async function renderCommand(template: string, options: RenderOptions) {
  // Check if Playwright is available before proceeding
  const pwCheck = await checkPlaywrightAvailable();
  if (!pwCheck.available) {
    console.error(`\nError: ${pwCheck.message}\n`);
    if (pwCheck.isServerless) {
      console.error("For serverless environments (Vercel, AWS Lambda, Netlify):");
      console.error("  pnpm add @sparticuz/chromium\n");
    } else {
      console.error("To render videos locally, you need to install Playwright browsers:");
      console.error("  superimg setup\n");
      console.error("Or use the dev server to preview and export from browser:");
      console.error("  superimg dev template.ts\n");
    }
    process.exit(1);
  }

  let resolvedTemplate: string;
  try {
    resolvedTemplate = resolveTemplatePath(template);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let templateData!: Awaited<ReturnType<typeof parseTemplate>>;
  try {
    templateData = await parseTemplate(resolvedTemplate);
  } catch (err) {
    console.error(`Error parsing template: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Mutual exclusion check
  if (options.preset && options.all) {
    console.error("Error: --preset and --all cannot be used together.");
    process.exit(1);
  }

  const resolvedConfig = resolveRenderConfig({
    cli: {
      width: options.width,
      height: options.height,
      fps: options.fps,
    },
    templateConfig: templateData.templateConfig,
  });

  const outputs = templateData.templateConfig?.outputs;

  // Build render targets
  let targets: RenderTarget[];

  if (options.all) {
    if (!outputs || Object.keys(outputs).length === 0) {
      console.error("Error: --all requires config.outputs to be defined in the template.");
      process.exit(1);
    }
    const presets = resolveAllPresets(outputs, resolvedConfig);
    const { base, ext } = splitFilename(options.output);
    targets = presets.map((p) => ({
      name: p.name,
      width: p.width,
      height: p.height,
      fps: p.fps,
      outputPath: resolve(`${base}-${p.name}${ext}`),
      outputName: p.name,
    }));
  } else if (options.preset) {
    if (!outputs || Object.keys(outputs).length === 0) {
      console.error("Error: --preset requires config.outputs to be defined in the template.");
      process.exit(1);
    }
    try {
      const preset = resolvePresetConfig(options.preset, outputs, resolvedConfig);
      targets = [{
        name: preset.name,
        width: preset.width,
        height: preset.height,
        fps: preset.fps,
        outputPath: resolve(options.output),
        outputName: preset.name,
      }];
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    // Default: single render with resolved config
    targets = [{
      name: "default",
      width: resolvedConfig.width,
      height: resolvedConfig.height,
      fps: resolvedConfig.fps,
      outputPath: resolve(options.output),
      outputName: "default",
    }];
  }

  function RenderUI() {
    const [progress, setProgress] = useState<RenderProgress>({
      frame: 0,
      totalFrames: 1,
      fps: resolvedConfig.fps,
    });
    const [currentTarget, setCurrentTarget] = useState(0);
    const [status, setStatus] = useState("Initializing Playwright...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const engine = new PlaywrightEngine();
      let mounted = true;

      (async () => {
        try {
          setStatus("Bundling template...");
          const resolveDir = dirname(resolvedTemplate);
          let bundledTemplateCode = "";

          if (templateData.templateCode) {
            bundledTemplateCode = await bundleTemplateCode(templateData.templateCode, resolveDir);
          }

          await engine.init();
          for (let i = 0; i < targets.length; i++) {
            if (!mounted) return;
            const target = targets[i];
            setCurrentTarget(i);
            setStatus(targets.length > 1
              ? `Rendering "${target.name}" (${i + 1}/${targets.length})...`
              : "Rendering...");

            const job: RenderJob = {
              templateCode: bundledTemplateCode,
              durationSeconds: resolvedConfig.durationSeconds,
              width: target.width,
              height: target.height,
              fps: target.fps,
              fonts: templateData.templateConfig?.fonts,
              inlineCss: templateData.templateConfig?.inlineCss,
              stylesheets: templateData.templateConfig?.stylesheets,
              outputName: target.outputName,
              encoding: buildEncodingOptions(options),
            };

            const plan = createRenderPlan(job);
            const { renderer, encoder } = engine.createAdapters();
            const result = await executeRenderPlan(plan, renderer, encoder, {
              onProgress: (p) => {
                if (mounted) setProgress(p);
              },
            });

            writeFileSync(target.outputPath, result);
          }

          if (!mounted) return;
          if (targets.length > 1) {
            const paths = targets.map((t) => t.outputPath).join("\n  ");
            setStatus(`Complete! Saved:\n  ${paths}`);
          } else {
            setStatus(`Complete! Saved to ${targets[0].outputPath}`);
          }
          await engine.dispose();
          setTimeout(() => process.exit(0), 1000);
        } catch (err) {
          if (!mounted) return;

          // Rich error formatting for TemplateRuntimeError
          if (err instanceof TemplateRuntimeError) {
            const details = err.details as {
              frame: number;
              timeContext?: TimeContext;
              dataSnapshot?: unknown;
            };
            const timeInfo = details.timeContext
              ? ` (${details.timeContext.sceneTimeSeconds.toFixed(3)}s, ${(details.timeContext.sceneProgress * 100).toFixed(1)}% progress)`
              : "";

            let errorMessage = `Frame ${details.frame}${timeInfo}\n\n${err.message}`;
            errorMessage += `\n\nSuggestion: ${err.suggestion}`;
            if (details.dataSnapshot) {
              errorMessage += `\n\nData at failure:\n${JSON.stringify(details.dataSnapshot, null, 2)}`;
            }
            setError(errorMessage);
          } else {
            setError(err instanceof Error ? err.message : String(err));
          }

          setStatus("Error");
          await engine.dispose();
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
          <Box marginTop={1}>
            <Text color="red">Error: {error}</Text>
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
      </Box>
    );
  }

  render(<RenderUI />);
}
