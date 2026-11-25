#!/usr/bin/env node
//! SuperImg CLI entry point
// Commands are lazy-loaded so init/dev/list work without Playwright installed.

import { Command, type Option } from "commander";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { registerDesktopCommands } from "./commands/desktop.js";
import { registerEditCommands } from "./commands/edit.js";
import { registerSkillReleaseCommands } from "./commands/register-skill-release.js";
import { registerNarrationCommands } from "./commands/narrate.js";
import { registerScriptCommands } from "./commands/script.js";
import { registerFilmCommands } from "./commands/film.js";

const program = new Command();
registerDesktopCommands(program);
const __dirname = dirname(fileURLToPath(import.meta.url));

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function getCliVersion(): string {
  const candidatePaths = [
    join(__dirname, "..", "package.json"),
    join(__dirname, "..", "..", "package.json"),
  ];

  for (const pkgPath of candidatePaths) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if ((pkg?.name === "@foxworth/superimg" || pkg?.name === "@foxworth/superimg-cli") && typeof pkg?.version === "string") {
        return pkg.version;
      }
    } catch {
      // Try next location
    }
  }

  return "0.0.0";
}

program
  .name("superimg")
  .description("SuperImg — responsive images and video from one media program")
  .version(getCliVersion());

program
  .command("init")
  .description(
    "Add a media library to a package or create a project from a packaged example",
  )
  .argument("[name]", "Project directory name", ".")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("--pm <manager>", "Package manager to use: npm, yarn, pnpm, bun")
  .option("--dir <path>", "Content directory within the selected package (default: media/)")
  .option("--skip-install", "Skip dependency installation")
  .option("--skip-browser", "Skip browser download (default until first export)")
  .option("--with-browser", "Download Chromium during init")
  .option(
    "--example <name>",
    "Example to copy: hello-world | request-journey | basics/…",
  )
  .option("--skip-skill", "Skip AI skill installation prompt")
  .action(async (name: string, options: {
    yes?: boolean;
    pm?: string;
    dir?: string;
    skipInstall?: boolean;
    skipBrowser?: boolean;
    withBrowser?: boolean;
    example?: string;
    skipSkill?: boolean;
  }) => {
    const { initCommand } = await import("./commands/init.js");
    const skipBrowser = options.withBrowser ? false : (options.skipBrowser ?? true);
    await initCommand(name, { ...options, skipBrowser });
  });

program
  .command("new")
  .description(
    "Copy a packaged example into the current package's media library",
  )
  .argument("[name]", "Output media name (optional; defaults to example name)")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("--dir <path>", "Content directory within the owning package (use . for its root)")
  .option(
    "--example <name>",
    "Example to copy (default: hello-world)",
  )
  .action(async (name: string | undefined, options: {
    yes?: boolean;
    example?: string;
    dir?: string;
  }) => {
    const { newCommand } = await import("./commands/new.js");
    await newCommand(name, options);
  });

program
  .command("dev")
  .description("Start development server with live preview")
  .argument("[template]", "Media name or path (omit for the project home page)")
  .option("-p, --port <port>", "Port number", "4747")
  .option("--no-open", "Don't open browser automatically")
  .option("--entry <id>", "Collection entry ID (defaults to the first entry)")
  .option("--edition <id>", "Preview one explicit art-directed edition")
  .option("--variant <id>", "Preview one explicit content variant")
  .action(async (template: string | undefined, options: { port: string; open: boolean; edition?: string; variant?: string; entry?: string }) => {
    const { devCommand } = await import("./commands/dev.js");
    await devCommand(template, options);
  });

program
  .command("export")
  .description("Export one media program for destinations or custom sizes")
  .argument("[template]", "Media name or path (defaults to the sole project media source)")
  .requiredOption("--for <target>", "Destination ID or WIDTHxHEIGHT[.format]", collect, [])
  .option("--entry <id>", "Collection entry ID (repeatable; defaults to every entry)", collect, [])
  .option("--variant <id>", "Content variant ID (repeatable; defaults to every variant)", collect, [])
  .option("--edition <id>", "Art-directed edition ID (repeatable; defaults to every edition)", collect, [])
  .option("--poster", "Use the explicit poster frame for animated-to-still exports")
  .option("--at <time>", "Freeze animated-to-still at explicit time (0s, 1.5s, or 1500ms)")
  .option("--duration <d>", "Arrangement motion duration, e.g. 6s")
  .option("--review", "Review one arrangement PNG or one authored MP4/WebM export; movies use exact encoded bytes")
  .option("-o, --output <path>", "Output file path (e.g. out.mp4) or .export bundle directory")
  .option("--label <name>", "Name the take this export records, e.g. \"cut 3\". The name works wherever a take id does")
  .option("--quality <level>", "Video quality preset: very-low, low, medium, high, very-high (not capture DPR)")
  .option("--alpha <mode>", "Video alpha: keep, discard")
  .option("--video-quantizer <n>", "Video quantizer (nonnegative)")
  .option("--preset <name>", "Encoding preset: prores-master, prores-master-alpha")
  .option("--video-codec <codec>", "Video codec: avc, vp9, av1, prores")
  .option("--video-bitrate <bps>", "Video bitrate in bits/second")
  .option("--audio-codec <codec>", "Audio codec: aac, opus, dts")
  .option("--audio-bitrate <bps>", "Audio bitrate in bits/second")
  .option("--keyframe-interval <seconds>", "Keyframe interval in seconds")
  .option("--bitrate-mode <mode>", "Video bitrate mode with --video-bitrate: constant, variable")
  .option("--latency-mode <mode>", "Latency mode: quality, realtime")
  .option("--hardware-accel <hint>", "Hardware acceleration: no-preference, prefer-hardware, prefer-software")
  .option("--audio-bitrate-mode <mode>", "Audio bitrate mode with --audio-bitrate: constant, variable")
  .option("--fast-start <mode>", "MP4 fast start: false, in-memory, fragmented")
  .option("--cluster-duration <seconds>", "WebM minimum cluster duration in seconds")
  .option("--max-colors <n>", "GIF max palette colors (2-256, default 256)")
  .option("--gif-loop <n>", "GIF loop count (0=infinite, -1=no loop)")
  .option("--gif-dither <algorithm>", "GIF dither algorithm (e.g. sierra2_4a, bayer, none)")
  .option("--dpr <n>", "Capture device pixel ratio (stills default 2, video 1; use 1 for 1× stills)")
  .option("--capture-cache", "Reuse unchanged static captures after readiness (dynamic content captures normally)")
  .option("--capture <codec>", "Intermediate screenshot codec: png | jpeg")
  .option("--still-quality <n>", "Still jpeg/webp quality 1–100 (default 95)")
  .option("--lossless", "Lossless still encode (webp masters)")
  .option("--color-profile <profile>", "Chromium color profile: srgb | display-p3")
  .option(
    "--deband <mode>",
    "Still gradient deband: none | blue-noise (default for png) | white-noise",
  )
  .option("--deband-strength <0-1>", "Deband amplitude 0–1 (default 0.35)")
  .option(
    "--still-bit-depth <n>",
    "PNG bit depth: 8 (wallpaper apply) or 16 (archival master)",
  )
  .option("--rasterizer <name>", "Runtime hint: playwright; portable interaction export rejects a blitz override")
  .option("--dry-run", "Print the exact direct interaction request without executing or publishing")
  .option("--json", "Output machine-readable JSON instead of human text")
  .option("--timeout <seconds>", "Cancel export after this many seconds")
  .option("--provider-timeout <seconds>", "Cancel a collection provider snapshot after this many seconds")
  .action(async (template: string | undefined, options) => {
    if (options.at !== undefined && !/^(?:\d+(?:\.\d*)?|\.\d+)(?:ms|s)$/i.test(options.at)) {
      throw Object.assign(new Error("--at requires a time in seconds or milliseconds, for example 0s or 500ms"), { code: "INVALID_TIME" });
    }
    const { exportCommand } = await import("./commands/export.js");
    await exportCommand(template, options);
  });

const takes = program
  .command("takes")
  .description("List source takes. Export records imported files, feedback, and a rendition receipt")
  .argument("[media]", "Media file or its directory. Omit to list every take under the project")
  .option("--json", "Machine-readable JSON, including good and bad")
  .action(async (media: string | undefined, options: { json?: boolean }) => {
    const { takesListCommand } = await import("./commands/takes.js");
    await takesListCommand(media, options);
  });

takes
  .command("feedback")
  .description("Append what was good or bad. A later export of the same sources keeps it")
  .argument("<id>", "Take id, unique prefix, or label")
  .option("--good <text>", "What worked. Repeat to append another line", collect, [])
  .option("--bad <text>", "What failed. Repeat to append another line", collect, [])
  .option("--note <text>", "Replace the take note")
  .option("--label <name>", "Name the take, e.g. \"cut 3\". Pass an empty string to clear it")
  .option("--replace", "Replace each passed good or bad list instead of appending")
  .option("--media <path>", "Media file or directory whose take store to use")
  .option("--json", "Machine-readable JSON")
  .action(async (id: string, options: { good?: string[]; bad?: string[]; note?: string; label?: string; replace?: boolean; media?: string; json?: boolean }) => {
    const { takesFeedbackCommand } = await import("./commands/takes.js");
    await takesFeedbackCommand(id, options);
  });

takes
  .command("restore")
  .description("Save the current sources as a take, then write this take's sources back")
  .argument("<id>", "Take id, unique prefix, or label")
  .option("--media <path>", "Media file or directory whose take store to use")
  .option("--json", "Machine-readable JSON")
  .action(async (id: string, options: { media?: string; json?: boolean }) => {
    const { takesRestoreCommand } = await import("./commands/takes.js");
    await takesRestoreCommand(id, options);
  });

takes
  .command("show")
  .description("Print one file from a take without writing it")
  .argument("<id>", "Take id, unique prefix, or label")
  .argument("<file>", "Path stored on the take, or a unique file name")
  .option("--media <path>", "Media file or directory whose take store to use")
  .option("--json", "JSON with text or base64, instead of raw bytes")
  .action(async (id: string, file: string, options: { media?: string; json?: boolean }) => {
    const { takesShowCommand } = await import("./commands/takes.js");
    await takesShowCommand(id, file, options);
  });

takes
  .command("from")
  .description("Find the take whose rendition sha256 matches a video or image file")
  .argument("<file>", "Rendered file. The take id is not embedded in it")
  .option("--json", "Machine-readable JSON, including good and bad")
  .action(async (file: string, options: { json?: boolean }) => {
    const { takesFromCommand } = await import("./commands/takes.js");
    await takesFromCommand(file, options);
  });

takes
  .command("diff")
  .description("Compare two takes by shot/speech cues, duration, and changed source files")
  .argument("<from>", "Base take id, unique prefix, or label")
  .argument("<to>", "Target take id, unique prefix, or label")
  .option("--media <path>", "Media file or directory whose take store to use")
  .option("--json", "Machine-readable JSON diff")
  .action(async (from: string, to: string, options: { media?: string; json?: boolean }) => {
    const { takesDiffCommand } = await import("./commands/takes.js");
    await takesDiffCommand(from, to, options);
  });

program
  .command("cortex")
  .description("Write stills from a Cortex bundle JSON (value-first; not media.export)")
  .argument("<bundle>", "Path to a Cortex bundle JSON file")
  .requiredOption("--for <target>", "Destination ID or WIDTHxHEIGHT[.format]", collect, [])
  .option("--at <time>", "Still freeze time in seconds (default 0)", "0")
  .option("--view <id>", "Pin a stock view id")
  .option("-o, --output <dir>", "Output directory (default: output/cortex.export)")
  .option("--json", "Machine-readable write report")
  .action(async (bundle: string, options: {
    for: string[];
    at?: string;
    view?: string;
    output?: string;
    json?: boolean;
  }) => {
    const { cortexCommand } = await import("./commands/cortex.js");
    await cortexCommand(bundle, options);
  });

program
  .command("info")
  .description("Show media information")
  .argument("<template>", "Path to media source")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (template: string, options: { json?: boolean }) => {
    const { infoCommand } = await import("./commands/info.js");
    await infoCommand(template, options);
  });

program
  .command("inspect")
  .option("--profile", "Emit command phase timings and invocation counts as JSON on stderr")
  .option("--trace", "Record a Playwright trace for --rendered-layout (off by default)")
  .option("--rendered-layout", "Measure layout in Chromium after fonts load at the selected frame")
  .description("Runtime-true multi-progress debug report (JSON). Phases, HTML semantics, optional --diff/--png.")
  .argument("<template>", "Media name or path")
  .option("--at <list>", "Samples: explicit progress (50%), seconds/ms (17.7s, 17700ms), or frames (f:531, 531f)")
  .option("--diff <a,b>", "Semantic-diff two progresses (e.g. 0.35,0.85)")
  .option("--png", "Also write PNG stills via Playwright")
  .option("--review", "Write a compact review packet with PNG evidence and a labeled contact sheet")
  .option("--review-clips", "With --review, render opt-in short clips for authored review ranges")
  .option("--review-file <path>", "Explicit review companion (default: colocated <stem>.review.ts)")
  .option("-o, --output <dir>", "Artifact dir (default: <templateDir>/output/.superimg/inspect/)")
  .option("--pretty", "Human phase/sample table on stderr (JSON still on stdout)")
  .option("--summary", "Emit config and phases without rendering HTML samples")
  .option("--data <path-or-json>", "Data override (object only)")
  .option("--entry <id>", "Collection entry ID (defaults to the first entry)")
  .option(
    "--variant <id>",
    "Use one root-level content variant",
  )
  .option("--edition <id>", "Inspect one explicit art-directed edition")
  .option("--for <target>", "Inspect for a destination ID or WIDTHxHEIGHT")
  .option("--json", "Explicit JSON mode (default; no-op)")
  .action(async (template: string, options) => {
    if (options.at !== undefined) {
      const { parseCliAtList } = await import("./utils/inspect-at.js");
      parseCliAtList(options.at);
    }
    if (options.diff !== undefined) {
      const { parseDiffPair } = await import("./utils/inspect-at.js");
      try { parseDiffPair(options.diff); }
      catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code: "INVALID_DIFF" }); }
    }
    if (template.toLowerCase().endsWith(".json")) {
      const { classifyArrangement, inspectArrangement } = await import("./utils/arrangement-input.js");
      const input = await classifyArrangement(template);
      if (input) {
        if (options.diff || options.png || options.reviewClips || options.reviewFile || options.pretty || options.summary || options.data || options.entry || options.variant || options.for || options.profile || options.trace || (options.output && !options.review)) {
          throw Object.assign(new Error("Arrangement inspection supports one --at sample, --edition, --rendered-layout and --review"), { code: "UNSUPPORTED_SELECTION" });
        }
        const report = await inspectArrangement(input, options.renderedLayout === true, options.edition, options.at, options.review === true, options.output);
        if (report.findings.some(finding => finding.severity === "error")) process.exitCode = 1;
        if ("review" in report && report.review?.technical === "fail") process.exitCode = 1;
        const { commandResult } = await import("./utils/command-result.js");
        const ok = !report.findings.some(finding => finding.severity === "error") && !("review" in report && report.review?.technical === "fail");
        process.stdout.write(`${JSON.stringify(commandResult(report, { ok, ...(ok ? {} : { code: "INSPECT_FAILED", message: "Inspection completed with failed findings." }) }))}\n`);
        return;
      }
    }
    const { withCommandProfile, profileStage } = await import("./utils/command-profile.js");
    await withCommandProfile("inspect", options, async () => {
      const { inspectCommand } = await profileStage("command.load", () => import("./commands/inspect.js"));
      return inspectCommand(template, options);
    });
  });

program
  .command("list")
  .description("List all discovered media sources in the project")
  .option("--json", "Output machine-readable JSON instead of human text")
  .option("--shallow", "List media paths without compiling media metadata")
  .action(async (options: { json?: boolean; shallow?: boolean }) => {
    const { listCommand } = await import("./commands/list.js");
    await listCommand(options);
  });

program
  .command("discover")
  .description("Fast media discovery without executing collection providers")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (options: { json?: boolean }) => {
    const { discoverCommand } = await import("./commands/discover.js");
    await discoverCommand(options);
  });

program
  .command("compile")
  .description("Compile media to a portable .superimg/ Media IR artifact")
  .argument("<template>", "Media name or path")
  .option("--data <path-or-json>", "Data override")
  .option("--verify", "Double-pass determinism verification")
  .option("--strict", "Reject anonymous, sampled, non-portable, or non-deterministic IR")
  .option("--target <target>", "Target runtime: web | native", "web")
  .option("--artifact-version <version>", "Artifact schema version (0 or 1; 1 retains native modules)")
  .option("-o, --output <dir>", "Artifact output directory")
  .option("--json", "Machine-readable JSON on stdout")
  .option("--pretty", "Pretty-print JSON")
  .action(async (template: string, options) => {
    const { compileCommand } = await import("./commands/compile.js");
    await compileCommand(template, options);
  });

registerEditCommands(program);

program
  .command("diff")
  .description(
    "Diff two Media IR manifests/artifacts, or --baseline vs current template",
  )
  .argument("[before]", "Before media.json / .superimg / template (or template with --baseline)")
  .argument("[after]", "After media.json / .superimg / template")
  .option("--pretty", "Pretty-print JSON")
  .option("--json", "JSON mode (default)")
  .option("--baseline", "Compare saved baseline to current template IR")
  .option(
    "--expect-only <ids>",
    "Comma-separated expected change ids/globs (exit 1 on unexpected or missing)",
  )
  .option("--data <path-or-json>", "Data override when compiling template IR")
  .option(
    "--fail-on <kind>",
    "Exit 1 when matching changes: any|timing|content|motion|assets|opaque|none",
    "none",
  )
  .option(
    "--render-changes",
    "Render affected verification frames as a labeled PNG contact sheet",
  )
  .action(async (before: string | undefined, after: string | undefined, options) => {
    const { diffCommand } = await import("./commands/diff.js");
    const code = await diffCommand(before, after, options);
    process.exitCode = code;
  });

program
  .command("baseline")
  .description("Save / show / clear Media IR baselines for expect-only diffs")
  .argument("<action>", "save | show | clear")
  .argument("[template]", "Template path (required for save)")
  .option("--data <path-or-json>", "Data override when saving")
  .option("--all", "Clear all baselines")
  .option("--pretty", "Pretty-print JSON")
  .action(async (action: string, template: string | undefined, options) => {
    const bas = await import("./commands/baseline.js");
    if (action === "save") {
      if (!template) {
        console.error("baseline save requires a template");
        process.exitCode = 1;
        return;
      }
      process.exitCode = await bas.baselineSaveCommand(template, options);
    } else if (action === "show") {
      process.exitCode = await bas.baselineShowCommand(template, options);
    } else if (action === "clear") {
      process.exitCode = await bas.baselineClearCommand(template, options);
    } else {
      console.error(`Unknown baseline action: ${action}`);
      process.exitCode = 1;
    }
  });

program
  .command("check")
  .option("--profile", "Emit command phase timings and invocation counts as JSON on stderr")
  .option("--trace", "Record a Playwright trace for --rendered-layout (off by default)")
  .option("--rendered-layout", "Measure layout in Chromium after fonts load at the selected frame")
  .description(
    "Pass/fail agent gate: resolve, validate, and sample schema-0 media",
  )
  .argument(
    "[template]",
    "Media name or path (optional when the project has exactly one source)",
  )
  .option("--at <list>", "Samples: explicit progress (50%), seconds/ms (17.7s, 17700ms), or frames (f:531, 531f)")
  .option("--data <path-or-json>", "Data override (object only)")
  .option("--entry <id>", "Collection entry ID (repeatable; defaults to every entry)", collect, [])
  .option("--edition <id>", "Check one explicit art-directed edition")
  .option("--for <target>", "Check for a destination ID or WIDTHxHEIGHT")
  .option("--variant <id>", "Check one root-level content variant")
  .option("--craft", "Also run motion craft checks as warnings")
  .option("--craft-strict", "Fail check on craft issues")
  .option("--craft-ignore <ids>", "Comma-separated CRAFT_IR_* rule ids to suppress")
  .option("--ir", "Also compile Media IR in-memory and report capability + craft-lint issues")
  .option(
    "--seam-visual",
    'For temporal: "loop", compare the encoded wrap with neighboring frame motion (slower; needs Chromium)',
  )
  .option(
    "--seam-visual-threshold <mae>",
    "Absolute MAE tolerance 0–255 above the neighboring motion allowance (default 2.5)",
  )
  .option("--pretty", "Human summary on stderr (JSON still on stdout)")
  .option("--summary", "Config + phases + source footguns only (no multi-frame HTML samples)")
  .option("--target <target>", "Target runtime: web | native", "web")
  .option("--json", "Explicit JSON mode (default; no-op)")
  .action(async (template: string | undefined, options) => {
    if (options.at !== undefined) {
      const { parseCliAtList } = await import("./utils/inspect-at.js");
      parseCliAtList(options.at);
    }
    if (template?.toLowerCase().endsWith(".json")) {
      const { checkArrangement, classifyArrangement, ArrangementFailure } = await import("./utils/arrangement-input.js");
      const input = await classifyArrangement(template);
      if (input) {
        const unsupported = options.renderedLayout || options.at || options.data || options.entry?.length || options.variant || options.for || options.craft || options.craftStrict || options.craftIgnore || options.ir || options.seamVisual || options.seamVisualThreshold || options.trace || options.profile || options.pretty || options.summary || (options.target !== undefined && options.target !== "web");
        if (unsupported) throw Object.assign(new Error("Arrangement check supports admission only; remove inspection and selection options"), { code: "UNSUPPORTED_SELECTION" });
        const result = await checkArrangement(template, input, options.edition ? [options.edition] : []);
        if (!result.ok) throw new ArrangementFailure(result.failures);
        const { commandResult } = await import("./utils/command-result.js");
        process.stdout.write(`${JSON.stringify(commandResult(result))}\n`);
        return;
      }
    }
    const { withCommandProfile, profileStage } = await import("./utils/command-profile.js");
    await withCommandProfile("check", options, async () => {
      const { checkCommand } = await profileStage("command.load", () => import("./commands/check.js"));
      return checkCommand(template, {
        ...options,
        seamVisual: options.seamVisual === true,
        ...(options.seamVisualThreshold !== undefined
          ? { seamVisualThreshold: String(options.seamVisualThreshold) }
          : {}),
      });
    });
  });

program
  .command("setup")
  .description("Download required browser for rendering")
  .action(async () => {
    const { setupCommand } = await import("./commands/setup.js");
    await setupCommand();
  });

program
  .command("doctor")
  .description("Check environment health and export prerequisites")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (options: { json?: boolean }) => {
    const { doctorCommand } = await import("./commands/doctor.js");
    await doctorCommand(options);
  });

const media = program
  .command("media")
  .description("Inspect and manage local/direct media assets");

media
  .command("probe")
  .description("Inspect local media tracks through the active runtime")
  .argument("<file>", "Local media file")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (file: string, options: { json?: boolean }) => {
    const { mediaProbeCommand } = await import("./commands/media.js");
    await mediaProbeCommand(file, options);
  });

media
  .command("convert")
  .description("Convert local media or assemble selected tracks from a plan")
  .option("--alpha <mode>", "Video alpha: keep, discard")
  .option("--video-quantizer <n>", "Codec-specific video quantizer")
  .argument("[file]", "Local media file (omit with --plan)")
  .option("--plan <file>", "Conversion plan JSON; source paths resolve relative to it")
  .option("--format <format>", "mp4 (default), webm, mov, or mkv")
  .option("-o, --output <file>", "Output file path")
  .option("--video-track <id>", "Video track ID (defaults to the first video track)")
  .option("--audio-track <id>", "Audio track ID (repeatable; defaults to all audio tracks)", collect)
  .option("--preset <name>", "Encoding preset: prores-master, prores-master-alpha")
  .option("--quality <level>", "Video quality: very-low, low, medium, high, very-high")
  .option("--video-codec <codec>", "Video codec: avc, vp9, av1, prores")
  .option("--audio-codec <codec>", "Audio codec: aac, opus, dts")
  .option("--video-bitrate <bps>", "Video bitrate in bits/second")
  .option("--audio-bitrate <bps>", "Audio bitrate in bits/second")
  .option("--bitrate-mode <mode>", "Video bitrate mode: constant, variable")
  .option("--audio-bitrate-mode <mode>", "Audio bitrate mode: constant, variable")
  .option("--json", "Output machine-readable JSON")
  .action(async (file: string | undefined, options) => {
    const { mediaConvertCommand } = await import("./commands/media.js");
    await mediaConvertCommand(file, options);
  });

media
  .command("import")
  .description("Import a local media file into the project media cache")
  .argument("<file>", "Local media file")
  .option("--name <name>", "Imported asset name")
  .option("--start <time>", "Source start time metadata, e.g. 01:02 or 4.2s")
  .option("--duration <duration>", "Clip duration metadata, e.g. 18s")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (file: string, options: { name?: string; start?: string; duration?: string; json?: boolean }) => {
    const { mediaImportCommand } = await import("./commands/media.js");
    await mediaImportCommand(file, options);
  });

const mediaCache = media
  .command("cache")
  .description("Manage the local media cache");

mediaCache
  .command("clean")
  .description("Remove imported local media cache files")
  .action(async () => {
    const { mediaCacheCleanCommand } = await import("./commands/media.js");
    await mediaCacheCleanCommand();
  });

program
  .command("plate")
  .description("Compile a short clip into a seekable alpha atlas (no generation)")
  .argument("<file>", "Local video or image sequence source")
  .option("--json", "Machine-readable JSON on stdout")
  .action(async (file: string, options: { json?: boolean }) => {
    const { plateCommand } = await import("./commands/plate.js");
    await plateCommand(file, options);
  });

registerSkillReleaseCommands(program);
registerNarrationCommands(program);
registerScriptCommands(program);
registerFilmCommands(program);

const argv = process.argv.slice(2);
const literalIndex = argv.indexOf("--");
const optionsArgv = literalIndex < 0 ? argv : argv.slice(0, literalIndex);
const machine = optionsArgv.includes("--json") || argv[0] === "check" || argv[0] === "inspect";
if (machine) {
  // Commander copies parent settings at command creation, so configure every
  // existing descendant, including commands registered by other modules.
  const configure = (command: Command): void => {
    command.exitOverride();
    command.configureOutput({ writeErr: () => {} });
    for (const child of command.commands) configure(child);
  };
  configure(program);
}
try {
  // Commander consumes the following token for a required option even if it
  // is another flag. Inspect the registered command tree before dispatch.
  let selected = program;
  for (let i = 0; i < optionsArgv.length; i++) {
    const token = optionsArgv[i]!;
    const child = selected.commands.find(command => command.name() === token || command.aliases().includes(token));
    if (child) { selected = child; continue; }
    const flag = token.split("=", 1)[0];
    let owner: Command | null = selected;
    let option: Option | undefined;
    while (owner && !option) {
      option = owner.options.find(item => item.long === flag || item.short === flag);
      owner = owner.parent;
    }
    if (option?.required && !token.includes("=")) {
      const value = optionsArgv[i + 1];
      if (value === undefined || (value.startsWith("-") && !/^-(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) {
        throw Object.assign(new Error(`option '${option.flags}' argument missing`), { code: "commander.optionMissingArgument" });
      }
      i++;
    }
  }
  await program.parseAsync();
} catch (error) {
  const e = error as { code?: string; path?: string; message?: string; failures?: unknown; exitCode?: number; certainty?: string; certaintyScope?: string; phase?: string; effectState?: string; effect?: string; findings?: unknown; details?: unknown; suggestion?: string };
  const { commandError } = await import("./utils/command-result.js");
  const outcome = commandError(error);
  if (e.code === "commander.helpDisplayed" || e.code === "commander.version") process.exitCode = 0;
  else if (machine) {
    process.exitCode = outcome.exitCode;
    process.stdout.write(`${JSON.stringify(outcome.result)}\n`);
  } else {
    process.exitCode = outcome.exitCode;
    process.stderr.write(`${e.message ?? "Command failed"}\n`);
    if (Array.isArray(e.failures)) for (const failure of e.failures) {
      const item = failure as { code?: string; message?: string };
      process.stderr.write(`  ${item.code ?? "ERROR"}: ${item.message ?? ""}\n`);
    }
  }
}
