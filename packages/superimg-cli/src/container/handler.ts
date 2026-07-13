//! Container process entrypoint: load manifest, validate runtime, start the
//! bounded render supervisor, then expose the HTTP app.

import { serve } from "@hono/node-server";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import type { RenderLimits } from "@superimg/types";
import { createContainerApp, type ContainerManifest } from "./app.js";
import { RenderSupervisor } from "./render-supervisor.js";

const execFileAsync = promisify(execFile);
export type Manifest = ContainerManifest;

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const MANIFEST_PATH = process.env.SUPERIMG_MANIFEST_PATH ?? "/app/manifest.json";
const PORT = positiveEnv("PORT", 8080);
const RENDER_TIMEOUT_MS = positiveEnv("RENDER_TIMEOUT_MS", 120_000);
const RENDER_CONCURRENCY = positiveEnv("RENDER_CONCURRENCY", 1);
const RENDER_MAX_QUEUE = positiveEnv("RENDER_MAX_QUEUE", 8);
const RENDER_CANCEL_GRACE_MS = positiveEnv("RENDER_CANCEL_GRACE_MS", 2_000);
const RENDER_MAX_REQUEST_BYTES = positiveEnv("RENDER_MAX_REQUEST_BYTES", 1_048_576);
const RENDER_MAX_OUTPUT_BYTES = positiveEnv("RENDER_MAX_OUTPUT_BYTES", 536_870_912);

const RENDER_LIMITS: RenderLimits = {
  maxWidth: positiveEnv("RENDER_MAX_WIDTH", 7_680),
  maxHeight: positiveEnv("RENDER_MAX_HEIGHT", 4_320),
  maxFps: positiveEnv("RENDER_MAX_FPS", 120),
  maxDurationSeconds: positiveEnv("RENDER_MAX_DURATION_SECONDS", 3_600),
  maxFrames: positiveEnv("RENDER_MAX_FRAMES", 216_000),
  maxAssets: positiveEnv("RENDER_MAX_ASSETS", 1_000),
};

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

async function getFfmpegVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-version"]);
    return stdout.match(/ffmpeg version ([^\s]+)/)?.[1] ?? "unknown";
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  process.on("uncaughtException", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const hint = message.toLowerCase().includes("memory")
      ? " (possible OOM — increase container memory)"
      : "";
    console.error(`[superimg] uncaughtException:${hint}`, message);
    process.exit(1);
  });

  const manifest = loadManifest();
  console.log(`[superimg] Manifest loaded. Templates: ${Object.keys(manifest).join(", ")}`);
  const ffmpegVersion = await getFfmpegVersion();
  if (!ffmpegVersion) {
    console.error("[superimg] ffmpeg not found — container image misconfigured");
    process.exit(1);
  }

  const supervisor = new RenderSupervisor({
    concurrency: RENDER_CONCURRENCY,
    maxQueued: RENDER_MAX_QUEUE,
    cancellationGraceMs: RENDER_CANCEL_GRACE_MS,
  });
  await supervisor.start();

  const app = createContainerApp({
    manifest,
    supervisor,
    renderTimeoutMs: RENDER_TIMEOUT_MS,
    cancellationGraceMs: RENDER_CANCEL_GRACE_MS,
    maxRequestBytes: RENDER_MAX_REQUEST_BYTES,
    maxOutputBytes: RENDER_MAX_OUTPUT_BYTES,
    renderLimits: RENDER_LIMITS,
    getFfmpegVersion,
  });
  serve({ fetch: app.fetch, port: PORT });
  console.log(`[superimg] Ready. ffmpeg=${ffmpegVersion} port=${PORT}`);

  const shutdown = () => {
    void supervisor.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main();
