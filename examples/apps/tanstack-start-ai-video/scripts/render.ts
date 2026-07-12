#!/usr/bin/env node
// Renders a video in a standalone Node process, invoked from
// src/routes/api/export.ts via child_process — kept out of the app's SSR
// bundle on purpose, since the Vite/Nitro build cannot safely trace into
// superimg/server's bundled Playwright/oxc-parser internals through a pnpm
// workspace symlink (same class of issue as
// https://github.com/vercel/next.js/issues/84388, but for the SSR bundler).

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderVideo } from "superimg/server";
import type { TimelineData } from "../src/lib/template.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

interface RenderInput {
  data: TimelineData;
  duration: number;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw) as RenderInput;

  const templatePath = resolve(APP_ROOT, "src", "lib", "timeline.media.ts");

  const video = await renderVideo(templatePath, {
    data: input.data as unknown as Record<string, unknown>,
    width: 1920,
    height: 1080,
    duration: input.duration,
  });

  process.stdout.write(video);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
