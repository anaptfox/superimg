#!/usr/bin/env node

import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderVideo } from "superimg/server";
import { extractGitAnalytics } from "./git.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CliArgs {
  output?: string;
  count: number;
  format: "horizontal" | "vertical" | "square";
  template: "timeline" | "contributors" | "race";
  branch?: string;
  since?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    count: 8,
    format: "horizontal",
    template: "contributors",
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "-o":
      case "--output":
        args.output = next;
        i++;
        break;
      case "-n":
      case "--count":
        args.count = Math.max(3, Math.min(12, parseInt(next, 10) || 8));
        i++;
        break;
      case "-f":
      case "--format":
        if (next === "vertical" || next === "horizontal" || next === "square") {
          args.format = next;
        }
        i++;
        break;
      case "-t":
      case "--template":
        if (next === "timeline" || next === "contributors" || next === "race") {
          args.template = next;
        }
        i++;
        break;
      case "-b":
      case "--branch":
        args.branch = next;
        i++;
        break;
      case "--since":
        args.since = next;
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
  git-history-video — Generate a timeline video from git history

  Usage:
    git-history-video [options]

  Options:
    -o, --output <file>    Output file (default: output/<template>.mp4)
    -n, --count <n>        Number of commits to include, 3-12 (default: 8)
    -f, --format <fmt>     horizontal | vertical | square (default: horizontal)
    -t, --template <name>  timeline | contributors | race (default: contributors)
    -b, --branch <name>    Git branch (default: current)
        --since <date>     Only include commits after this date (e.g. 2024-01-01)
    -h, --help             Show this help

  Examples:
    git-history-video
    git-history-video -o my-project.mp4 -n 6
    git-history-video --template contributors
    git-history-video --format vertical --since 2024-01-01
`);
}

function progressBar(ratio: number, width = 30): string {
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const FORMATS = {
  horizontal: { width: 1920, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

function resolveTemplatePath(template: CliArgs["template"]): string {
  const tsPath = resolve(__dirname, "templates", `${template}.ts`);
  if (existsSync(tsPath)) return tsPath;
  return resolve(__dirname, "templates", `${template}.js`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 1. Extract git history
  console.log("  Extracting git history...");
  let analytics;
  try {
    analytics = extractGitAnalytics({
      count: args.count,
      branch: args.branch,
      since: args.since,
    });
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  console.log(`  ✓ ${analytics.timeline.events.length} milestones from "${analytics.repoName}"`);

  // 2. Render
  const templatePath = resolveTemplatePath(args.template);
  const { width, height } = FORMATS[args.format];
  const outputDir = resolve(__dirname, "..", "output");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = args.output ?? resolve(outputDir, `${args.template}.mp4`);

  const templateData =
    args.template === "timeline"
      ? { title: analytics.timeline.title, events: analytics.timeline.events }
      : args.template === "contributors"
        ? {
            title: analytics.repoName,
            contributors: analytics.contributors,
          }
        : {
            title: analytics.repoName,
            months: analytics.raceMonths,
            series: analytics.raceSeries,
          };

  console.log(`  Rendering ${args.template} (${args.format}, ${width}×${height})...`);

  await renderVideo(templatePath, {
    data: templateData as unknown as Record<string, unknown>,
    output: outputPath,
    width,
    height,
    duration: 12,
    onProgress: (frame, total) => {
      const pct = Math.round((frame / total) * 100);
      process.stdout.write(`\r  [${progressBar(frame / total)}] ${pct}%`);
    },
  });

  console.log(`\n  ✓ Saved to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
