#!/usr/bin/env node
//! podcast-splash — render a podcast speaker splash intro for every entry in
//! speakers.json, in every preset declared by the template (YouTube + Reel).
//!
//! This is the canonical SDK demo of `renderBatch` — the framework owns
//! parse/bundle/Playwright-reuse/output-naming; the app owns the data and a
//! tiny argv loop.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBatch } from "superimg/server";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CliArgs {
  data: string;
  output?: string;
  format: "youtube" | "reel" | "both";
  help: boolean;
}

const APP_ROOT = resolve(__dirname, "..");
const DEFAULTS: CliArgs = {
  data: resolve(APP_ROOT, "speakers.json"),
  format: "both",
  help: false,
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "-d":
      case "--data":
        args.data = next;
        i++;
        break;
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
  podcast-splash — render a splash intro for every speaker in a JSON file

  Usage:
    podcast-splash [options]

  Options:
    -d, --data <path>     Path to speakers JSON (default: ../speakers.json)
    -o, --output <dir>    Output directory (default: next to template)
    -f, --format <fmt>    youtube | reel | both (default: both)
    -h, --help            Show this help

  Each entry in the JSON becomes one render per requested format. Filenames
  follow \`splash-<slug>-<format>.mp4\` (slug from \`slug\` / \`name\` / \`title\` /
  \`id\` field, falling back to the array index).
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const dataPath = resolve(args.data);
  if (!existsSync(dataPath)) {
    console.error(`✗ Data file not found: ${dataPath}`);
    process.exit(1);
  }

  const dataset = JSON.parse(readFileSync(dataPath, "utf-8")) as Record<string, unknown>[];
  if (!Array.isArray(dataset) || dataset.length === 0) {
    console.error(`✗ ${dataPath} must contain a non-empty array of speakers.`);
    process.exit(1);
  }

  const templatePath = resolve(__dirname, "templates", "splash.video.ts");

  const isBoth = args.format === "both";
  const useAllPresets = isBoth;
  const singlePreset = !isBoth ? args.format : undefined;

  console.log(`  podcast-splash — ${dataset.length} speaker(s) × ${isBoth ? "2 formats" : "1 format"}`);

  const results = await renderBatch(templatePath, {
    dataset,
    presets: useAllPresets,
    preset: singlePreset,
    output: args.output ?? resolve(APP_ROOT, "output") + "/",
    onProgress: ({ entryIndex, entryTotal, target, progress }) => {
      const pct = Math.round((progress.frame / progress.totalFrames) * 100);
      process.stdout.write(
        `\r  [${entryIndex + 1}/${entryTotal}] ${target.entryLabel ?? "default"} (${target.name}) ${pct}%   `,
      );
    },
  });

  process.stdout.write("\n");
  for (const r of results) {
    const name = (r.entry.speakerName as string | undefined) ?? r.entry.slug ?? `entry ${r.entryIndex}`;
    console.log(`  ✓ ${name}`);
    for (const out of r.outputs) {
      console.log(`      ${out.name.padEnd(8)} → ${out.outputPath}`);
    }
  }
}

main().catch((err) => {
  console.error("\n", err instanceof Error ? err.message : err);
  process.exit(1);
});
