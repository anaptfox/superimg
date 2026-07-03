#!/usr/bin/env node

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderVideo } from "superimg/server";
import { clamp, scrapeToKaraokeData } from "../lib/scrape";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

interface CliArgs {
  url?: string;
  textPath?: string;
  output?: string;
  format: "horizontal" | "vertical" | "square";
  wpm: number;
  maxWords: number;
  help: boolean;
}

const FORMATS = {
  horizontal: { width: 1920, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    format: "vertical",
    wpm: 128,
    maxWords: 140,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--text":
        args.textPath = next;
        i++;
        break;
      case "-o":
      case "--output":
        args.output = next;
        i++;
        break;
      case "-f":
      case "--format":
        if (next === "horizontal" || next === "vertical" || next === "square") args.format = next;
        i++;
        break;
      case "--wpm":
        args.wpm = clamp(parseInt(next, 10) || args.wpm, 90, 180);
        i++;
        break;
      case "--max-words":
        args.maxWords = clamp(parseInt(next, 10) || args.maxWords, 40, 420);
        i++;
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        if (!arg.startsWith("-") && !args.url) args.url = arg;
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
  blog-to-video — turn a blog post into a karaoke read-along video

  Usage:
    pnpm cli -- <url> [options]
    pnpm cli -- --text ./post.txt [options]

  Options:
    --text <path>          Use a local text or HTML file instead of fetching a URL
    -o, --output <file>    Output file (default: output/blog-to-video.mp4)
    -f, --format <fmt>     horizontal | vertical | square (default: vertical)
    --wpm <number>         Estimated reading speed, 90-180 (default: 128)
    --max-words <number>   Max words to include, 40-420 (default: 140)
    -h, --help             Show this help
`);
}

function progressBar(ratio: number, width = 28): string {
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.url && !args.textPath) {
    printHelp();
    process.exit(1);
  }

  if (args.textPath && !existsSync(resolve(args.textPath))) {
    console.error(`  ✗ Text file not found: ${resolve(args.textPath)}`);
    process.exit(1);
  }

  console.log(args.textPath ? "  Reading article text..." : "  Fetching article...");

  const { loadArticle } = await import("../lib/article");
  const { buildKaraokeData } = await import("../lib/timing");

  let data;
  if (args.textPath) {
    const article = await loadArticle({ textPath: resolve(args.textPath) });
    data = buildKaraokeData({
      title: article.title,
      source: article.source,
      text: article.text,
      maxWords: args.maxWords,
      wpm: args.wpm,
    });
    if (data.words.length < 20) {
      console.error("  ✗ Not enough readable words found. Try --text with cleaned article text.");
      process.exit(1);
    }
  } else {
    data = await scrapeToKaraokeData({
      url: args.url,
      wpm: args.wpm,
      maxWords: args.maxWords,
    });
  }

  const templatePath = resolve(APP_ROOT, "lib", "karaoke.media.ts");
  const outputDir = resolve(APP_ROOT, "output");
  mkdirSync(outputDir, { recursive: true });

  const { width, height } = FORMATS[args.format];
  const output = args.output ?? resolve(outputDir, "blog-to-video.mp4");

  console.log(`  ✓ ${data.words.length} words from "${data.title}"`);
  console.log(`  Rendering ${args.format} (${width}×${height}, ${Math.round(data.duration)}s)...`);

  await renderVideo(templatePath, {
    data: data as unknown as Record<string, unknown>,
    output,
    width,
    height,
    duration: data.duration,
    onProgress: (frame, total) => {
      const ratio = frame / total;
      const pct = Math.round(ratio * 100);
      process.stdout.write(`\r  [${progressBar(ratio)}] ${pct}%`);
    },
  });

  console.log(`\n  ✓ Saved to ${output}`);
}

main().catch((err) => {
  console.error("\n", err instanceof Error ? err.message : err);
  process.exit(1);
});