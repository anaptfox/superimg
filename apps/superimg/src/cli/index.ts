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
    join(__dirname, "..", "package.json"), // dist -> apps/superimg/package.json
    join(__dirname, "..", "..", "package.json"), // src/cli -> apps/superimg/package.json
  ];

  for (const pkgPath of candidatePaths) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg?.name === "superimg" && pkg?.private !== true && typeof pkg?.version === "string") {
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
  .option("-p, --port <port>", "Port number", "8080")
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
  .option("--preset <name>", "Render a named output preset from config.outputs")
  .option("--presets", "Render all output presets defined in config.outputs")
  .option("--all", "Render all videos in project")
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
  .action(async (template: string) => {
    const { infoCommand } = await import("./commands/info.js");
    await infoCommand(template);
  });

program
  .command("list")
  .description("List all discovered videos in the project")
  .action(async () => {
    const { listCommand } = await import("./commands/list.js");
    await listCommand();
  });

program
  .command("setup")
  .description("Download required browser for rendering")
  .action(async () => {
    const { setupCommand } = await import("./commands/setup.js");
    await setupCommand();
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

program.parse();
