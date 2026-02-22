#!/usr/bin/env node
//! SuperImg CLI entry point

import { Command } from "commander";
import { devCommand } from "./commands/dev.js";
import { renderCommand } from "./commands/render.js";
import { infoCommand } from "./commands/info.js";
import { setupCommand } from "./commands/setup.js";

const program = new Command();

program
  .name("superimg")
  .description("SuperImg CLI - dev server and headless rendering (renders execute template code)")
  .version("0.1.0");

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

program.parse();
