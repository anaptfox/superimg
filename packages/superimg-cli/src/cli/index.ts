#!/usr/bin/env node
//! SuperImg CLI entry point
// Commands are lazy-loaded so init/dev/list work without Playwright installed.

import { Command } from "commander";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const program = new Command();
const __dirname = dirname(fileURLToPath(import.meta.url));

function getCliVersion(): string {
  const candidatePaths = [
    join(__dirname, "..", "package.json"),
    join(__dirname, "..", "..", "package.json"),
  ];

  for (const pkgPath of candidatePaths) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if ((pkg?.name === "superimg" || pkg?.name === "@superimg/cli") && typeof pkg?.version === "string") {
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
  .description("SuperImg - programmatic video generation with HTML/CSS templates")
  .version(getCliVersion());

program
  .command("init")
  .description("Create a new SuperImg template project, or add to an existing one")
  .argument("[name]", "Project directory name", ".")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("--js", "Use JavaScript instead of TypeScript")
  .option("--pm <manager>", "Package manager to use: npm, yarn, pnpm, bun")
  .option("--skip-install", "Skip dependency installation")
  .option("--skip-browser", "Skip browser download")
  .option("--skip-skill", "Skip AI skill installation prompt")
  .action(async (name: string, options: { yes?: boolean; js?: boolean; pm?: string; skipInstall?: boolean; skipBrowser?: boolean; skipSkill?: boolean }) => {
    const { initCommand } = await import("./commands/init.js");
    await initCommand(name, options);
  });

program
  .command("new")
  .description("Create a new video in the current project")
  .argument("[name]", "Video name (e.g. my-promo)")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("--js", "Use JavaScript instead of TypeScript")
  .option("--compose", "Scaffold a multi-scene composition")
  .option("--tailwind", "Enable Tailwind CSS")
  .action(async (name: string | undefined, options: { yes?: boolean; js?: boolean; compose?: boolean; tailwind?: boolean }) => {
    const { newCommand } = await import("./commands/new.js");
    await newCommand(name, options);
  });

program
  .command("dev")
  .description("Start development server with live preview")
  .argument("[template]", "Video name or path (omit for home page with all videos)")
  .option("-p, --port <port>", "Port number", "4747")
  .option("--no-open", "Don't open browser automatically")
  .action(async (template: string | undefined, options: { port: string; open: boolean }) => {
    const { devCommand } = await import("./commands/dev.js");
    await devCommand(template, options);
  });

program
  .command("render")
  .description("Render template to video")
  .argument("[template]", "Video name or path (optional for interactive mode)")
  .option("-y, --yes", "Non-interactive mode (requires template or --all)")
  .option("-o, --output <path>", "Output path (file or directory). Default: an output/ folder next to the template.")
  .option("--format <type>", "Output format: mp4, webm, gif")
  .option("-w, --width <pixels>", "Video width")
  .option("-h, --height <pixels>", "Video height")
  .option("--fps <fps>", "Frames per second")
  .option("--frame <n>", "Capture a single frame (pairs with --format png|webp|jpeg|html)")
  .option("--preset <name>", "Render a named output preset from config.outputs")
  .option("--presets", "Render all output presets defined in config.outputs")
  .option("--all", "Render all videos in project")
  .option("--data <path-or-json>", "Path to a .json/.ts/.js data file, or inline JSON. Object → 1 render; array → 1 render per entry. Composes with --presets.")
  .option("--quality <level>", "Video quality: very-low, low, medium, high, very-high")
  .option("--video-codec <codec>", "Video codec: avc, vp9, av1")
  .option("--video-bitrate <bps>", "Video bitrate in bits/second")
  .option("--audio-codec <codec>", "Audio codec: aac, opus")
  .option("--audio-bitrate <bps>", "Audio bitrate in bits/second")
  .option("--keyframe-interval <seconds>", "Keyframe interval in seconds")
  .option("--bitrate-mode <mode>", "Bitrate mode: constant, variable")
  .option("--latency-mode <mode>", "Latency mode: quality, realtime")
  .option("--hardware-accel <hint>", "Hardware acceleration: no-preference, prefer-hardware, prefer-software")
  .option("--audio-bitrate-mode <mode>", "Audio bitrate mode: constant, variable")
  .option("--fast-start <mode>", "MP4 fast start: false, in-memory, fragmented")
  .option("--cluster-duration <seconds>", "WebM minimum cluster duration in seconds")
  .option("--max-colors <n>", "GIF max palette colors (2-256, default 256)")
  .option("--gif-loop <n>", "GIF loop count (0=infinite, -1=no loop)")
  .option("--gif-dither <algorithm>", "GIF dither algorithm (e.g. sierra2_4a, bayer, none)")
  .option("--debug-html", "Save the underlying HTML of each frame next to the resolved output in .superimg/debug/")
  .option("--fail-on-error", "Exit non-zero if any video fails (useful in CI). Default: best-effort for --all.")
  .option("--dry-run", "Resolve and print render targets without actually rendering.")
  .option("--json", "Output machine-readable JSON instead of human text")
  .option("--distributed <endpoints>", "Comma-separated container URLs for distributed chunk rendering (e.g. https://a.example.com,https://b.example.com).")
  .action(async (template: string | undefined, options) => {
    const mod = await import("./commands/render.js");

    // Interactive mode: no template, no --all, no --yes
    if (!template && !options.all && !options.yes) {
      const { selectVideoInteractive } = await import("./commands/render-interactive.js");
      const selection = await selectVideoInteractive();
      if (!selection) process.exit(0); // User cancelled
      template = selection.template;
      if (selection.preset) options.preset = selection.preset;
    }

    // Require template if --yes without template (and not --all)
    if (!template && !options.all) {
      console.error("Error: <template> argument required with -y flag or use --all");
      process.exit(1);
    }

    await mod.renderCommand(template ?? "", options as Parameters<typeof mod.renderCommand>[1]);
  });

program
  .command("info")
  .description("Show template information")
  .argument("<template>", "Path to template file")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (template: string, options: { json?: boolean }) => {
    const { infoCommand } = await import("./commands/info.js");
    await infoCommand(template, options);
  });

program
  .command("inspect")
  .description("Runtime-true multi-progress debug report (JSON). Phases, HTML semantics, optional --diff/--png.")
  .argument("<template>", "Video name or path to template")
  .option("--at <list>", "Progress samples 0–1 and/or f:N frames (default: 0,0.25,0.5,0.75,1)")
  .option("--diff <a,b>", "Semantic-diff two progresses (e.g. 0.35,0.85)")
  .option("--png", "Also write PNG stills via Playwright")
  .option("-o, --output <dir>", "Artifact dir (default: <templateDir>/output/.superimg/inspect/)")
  .option("--pretty", "Human phase/sample table on stderr (JSON still on stdout)")
  .option("--critique", "Include motion craft critique (hold length, exit vs enter, text settle, …)")
  .option("--data <path-or-json>", "Data override (object only)")
  .option("--json", "Explicit JSON mode (default; no-op)")
  .action(async (template: string, options) => {
    const { inspectCommand } = await import("./commands/inspect.js");
    await inspectCommand(template, options);
  });

program
  .command("list")
  .description("List all discovered videos in the project")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (options: { json?: boolean }) => {
    const { listCommand } = await import("./commands/list.js");
    await listCommand(options);
  });

program
  .command("discover")
  .description("Fast template discovery — lists all templates with no template parsing (for build tools)")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (options: { json?: boolean }) => {
    const { discoverCommand } = await import("./commands/discover.js");
    await discoverCommand(options);
  });

program
  .command("validate")
  .description("Validate a template by rendering sample frames and checking for errors")
  .argument("<template>", "Video name or path to validate")
  .option("--frames <count>", "Number of sample frames to render (default: 5)", "5")
  .option("--craft", "Also run motion craft checks (hold length, text settle, …) as warnings")
  .option("--craft-strict", "Fail validation on craft issues")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (template: string, options: { frames: string; json?: boolean; craft?: boolean; craftStrict?: boolean }) => {
    const { validateCommand } = await import("./commands/validate.js");
    await validateCommand(template, options);
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
  .description("Check environment health and surface drift before render")
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
  .description("Probe a local media file")
  .argument("<file>", "Local media file")
  .option("--json", "Output machine-readable JSON instead of human text")
  .action(async (file: string, options: { json?: boolean }) => {
    const { mediaProbeCommand } = await import("./commands/media.js");
    await mediaProbeCommand(file, options);
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

const skill = program
  .command("skill")
  .description("Manage the SuperImg AI skill across coding agents (Claude, Codex, Cursor, Gemini, OpenCode, Pi, …)");

skill
  .command("install")
  .description("Install the SuperImg skill into one or more host targets")
  .option("--host <ids>", "Comma-separated host IDs (e.g. claude,codex,cursor) or 'all'")
  .option("--all-hosts", "Install for every supported host")
  .option("--global", "Also install into global host paths (where supported)")
  .option("--global-only", "Install only into global host paths")
  .option("-y, --yes", "Skip prompts; use defaults / auto-detection")
  .action(async (options) => {
    const { installCommand } = await import("./commands/skill/install.js");
    await installCommand(options);
  });

skill
  .command("update")
  .description("Refresh existing skill installs to the bundled version")
  .option("--host <ids>", "Comma-separated host IDs or 'all'")
  .option("--all-hosts", "Update every supported host (default)")
  .option("--global", "Include global host paths (default: both project and global)")
  .option("--global-only", "Update only global host paths")
  .option("--check", "Print status without writing")
  .action(async (options) => {
    const { updateCommand } = await import("./commands/skill/update.js");
    await updateCommand(options);
  });

skill
  .command("list")
  .description("Show what's installed where, and at what version")
  .option("--global", "Show only global paths")
  .action(async (options) => {
    const { listCommand } = await import("./commands/skill/list.js");
    await listCommand(options);
  });

skill
  .command("remove")
  .description("Strip the SuperImg skill from installed targets")
  .option("--host <ids>", "Comma-separated host IDs or 'all'")
  .option("--all-hosts", "Remove from every supported host")
  .option("--global", "Also remove from global host paths")
  .option("--global-only", "Remove only from global host paths")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options) => {
    const { removeCommand } = await import("./commands/skill/remove.js");
    await removeCommand(options);
  });

program
  .command("deploy")
  .argument("[template]", "Template to verify render parity after deploy")
  .description("Deploy templates to Cloudflare Containers")
  .option("--worker <name>", "Override CF Worker name")
  .option("--dry-run", "Generate artifacts only, skip Docker and wrangler")
  .option("--verify", "After deploy, verify local vs container render parity")
  .action(async (template, options) => {
    const { deployCommand } = await import("./commands/deploy.js");
    await deployCommand(template, options);
  });

program.parse();
