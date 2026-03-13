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
  .action(async (name: string, options: { yes?: boolean; js?: boolean; pm?: string; skipInstall?: boolean; skipBrowser?: boolean }) => {
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
  .argument("[template]", "Video name or path (optional with --all)")
  .option("-o, --output <path>", "Output path (file or directory, defaults to output/)")
  .option("--format <type>", "Output format: mp4, webm")
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
  .option("--debug-html", "Save the underlying HTML of each frame to .superimg/debug/")
  .action(async (template: string | undefined, options) => {
    const mod = await import("./commands/render.js");
    // Require template unless --all is used
    if (!template && !options.all) {
      console.error("Error: <template> argument required unless using --all");
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

program
  .command("add")
  .description("Add capabilities to your project")
  .argument("<item>", "Item to add: skill")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("--project", "Project only (AGENTS.md)")
  .option("--global", "Global only (skills.sh)")
  .action(async (item: string, options: { yes?: boolean; project?: boolean; global?: boolean }) => {
    const { addCommand } = await import("./commands/add.js");
    await addCommand(item, options);
  });

program.parse();
