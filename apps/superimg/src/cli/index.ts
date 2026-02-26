#!/usr/bin/env node
//! SuperImg CLI entry point

import { Command } from "commander";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { renderCommand } from "./commands/render.js";
import { infoCommand } from "./commands/info.js";
import { setupCommand } from "./commands/setup.js";
import { addCommand } from "./commands/add.js";

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
  .option("--js", "Use JavaScript instead of TypeScript")
  .option("--pm <manager>", "Package manager to use: npm, yarn, pnpm, bun")
  .action(initCommand);

program
  .command("dev")
  .description("Start development server with live preview")
  .argument("<template>", "Path to template file")
  .option("-p, --port <port>", "Port number", "3000")
  .option("--no-open", "Don't open browser automatically")
  .action(devCommand);

program
  .command("render")
  .description("Render template to video")
  .argument("<template>", "Path to template file")
  .requiredOption("-o, --output <file>", "Output video file path")
  .option("--format <type>", "Output format: mp4, webm")
  .option("-w, --width <pixels>", "Video width")
  .option("-h, --height <pixels>", "Video height")
  .option("--fps <fps>", "Frames per second")
  .option("--preset <name>", "Render a named output preset from config.outputs")
  .option("--all", "Render all output presets defined in config.outputs")
  .option("--quality <level>", "Video quality: very-low, low, medium, high, very-high")
  .option("--video-codec <codec>", "Video codec: avc, vp9, av1")
  .option("--video-bitrate <bps>", "Video bitrate in bits/second")
  .option("--audio-codec <codec>", "Audio codec: aac, opus")
  .option("--audio-bitrate <bps>", "Audio bitrate in bits/second")
  .option("--keyframe-interval <seconds>", "Keyframe interval in seconds")
  .action(renderCommand);

program
  .command("info")
  .description("Show template information")
  .argument("<template>", "Path to template file")
  .action(infoCommand);

program
  .command("setup")
  .description("Download required browser for rendering")
  .action(setupCommand);

program
  .command("add")
  .description("Add capabilities to your project")
  .argument("<item>", "Item to add: skill")
  .action(addCommand);

program.parse();
