#!/usr/bin/env node

import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderVideo } from "superimg/server";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Format = "youtube" | "reel" | "both";

interface CliArgs {
  output?: string;
  format: Format;
  podcast: string;
  episode: string;
  title: string;
  speaker: string;
  speakerTitle: string;
  photo: string;
  brandColor: string;
  accentColor: string;
  duration: number;
  help: boolean;
}

const FORMATS = {
  youtube: { width: 1920, height: 1080 },
  reel: { width: 1080, height: 1920 },
} as const;

const DEFAULTS: CliArgs = {
  format: "both",
  podcast: "The Build Log",
  episode: "042",
  title: "Why we ditched microservices",
  speaker: "Jane Doe",
  speakerTitle: "Principal Engineer @ TechCo",
  photo: "https://i.pravatar.cc/600?img=47",
  brandColor: "#FF4D6D",
  accentColor: "#FFD166",
  duration: 6,
  help: false,
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "-o":
      case "--output":
        args.output = next;
        i++;
        break;
      case "-f":
      case "--format":
        if (next === "youtube" || next === "reel" || next === "both") {
          args.format = next;
        }
        i++;
        break;
      case "--podcast":
        args.podcast = next;
        i++;
        break;
      case "--episode":
        args.episode = next;
        i++;
        break;
      case "--title":
        args.title = next;
        i++;
        break;
      case "--speaker":
        args.speaker = next;
        i++;
        break;
      case "--speaker-title":
        args.speakerTitle = next;
        i++;
        break;
      case "--photo":
        args.photo = next;
        i++;
        break;
      case "--brand-color":
        args.brandColor = next;
        i++;
        break;
      case "--accent-color":
        args.accentColor = next;
        i++;
        break;
      case "--duration":
        args.duration = Math.max(3, Math.min(15, parseFloat(next) || DEFAULTS.duration));
        i++;
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
  podcast-splash — Generate a podcast speaker splash intro

  Renders YouTube (1920×1080) and/or Reel (1080×1920) MP4s from a single
  responsive template using SuperImg's multi-output rendering.

  Usage:
    podcast-splash [options]

  Options:
    -o, --output <dir>       Output directory (default: ./output)
    -f, --format <fmt>       youtube | reel | both (default: both)
        --podcast <name>     Podcast name
        --episode <number>   Episode number (e.g. "042")
        --title <text>       Episode title
        --speaker <name>     Speaker name
        --speaker-title <t>  Speaker role/title
        --photo <url>        Speaker photo URL
        --brand-color <hex>  Primary accent color (default: #FF4D6D)
        --accent-color <hex> Secondary accent color (default: #FFD166)
        --duration <sec>     Duration in seconds, 3-15 (default: 6)
    -h, --help               Show this help

  Examples:
    podcast-splash
    podcast-splash --format reel
    podcast-splash --speaker "Ada Lovelace" --episode "001" \\
      --title "On the analytical engine" --photo https://example.com/ada.jpg
`);
}

function progressBar(ratio: number, width = 28): string {
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function renderOne(
  templatePath: string,
  formatName: "youtube" | "reel",
  args: CliArgs,
  outputDir: string
) {
  const { width, height } = FORMATS[formatName];
  const outputPath = resolve(outputDir, `splash-${formatName}.mp4`);

  console.log(`\n  Rendering ${formatName} (${width}×${height})...`);

  await renderVideo(templatePath, {
    width,
    height,
    duration: args.duration,
    output: outputPath,
    data: {
      podcastName: args.podcast,
      episodeNumber: args.episode,
      episodeTitle: args.title,
      speakerName: args.speaker,
      speakerTitle: args.speakerTitle,
      speakerPhoto: args.photo,
      brandColor: args.brandColor,
      accentColor: args.accentColor,
    },
    onProgress: (frame, total) => {
      const pct = Math.round((frame / total) * 100);
      process.stdout.write(`\r  [${progressBar(frame / total)}] ${pct}%`);
    },
  });

  console.log(`\n  ✓ Saved ${outputPath}`);
}

function resolveTemplatePath(): string {
  const tsPath = resolve(__dirname, "templates", "splash.ts");
  if (existsSync(tsPath)) return tsPath;
  return resolve(__dirname, "templates", "splash.js");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const templatePath = resolveTemplatePath();
  const outputDir = args.output
    ? resolve(args.output)
    : resolve(__dirname, "..", "output");
  mkdirSync(outputDir, { recursive: true });

  console.log("  podcast-splash");
  console.log(`  ${args.podcast} · Ep. ${args.episode} · ${args.speaker}`);

  const targets: Array<"youtube" | "reel"> =
    args.format === "both" ? ["youtube", "reel"] : [args.format];

  for (const target of targets) {
    await renderOne(templatePath, target, args, outputDir);
  }

  console.log(`\n  Done. ${targets.length} file(s) in ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
