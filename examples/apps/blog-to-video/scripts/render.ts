#!/usr/bin/env node
// Renders a video in a standalone Node process, invoked from app/api/export/route.ts
// via child_process — kept out of the Next.js route's static import graph on purpose,
// since Turbopack cannot externalize a pnpm workspace symlink like `superimg`
// (https://github.com/vercel/next.js/issues/84388) and fails tracing into its
// bundled Playwright/oxc-parser internals otherwise.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderVideo } from "superimg/server";
import type { KaraokeData } from "../lib/template.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

const FORMATS = {
  horizontal: { width: 1920, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

type Format = keyof typeof FORMATS;

interface RenderInput {
  data: KaraokeData;
  format: Format;
  duration: number;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw) as RenderInput;

  const templatePath = resolve(APP_ROOT, "lib", "karaoke.media.ts");
  const { width, height } = FORMATS[input.format];

  const video = await renderVideo(templatePath, {
    data: input.data as unknown as Record<string, unknown>,
    width,
    height,
    duration: input.duration,
  });

  process.stdout.write(video);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
