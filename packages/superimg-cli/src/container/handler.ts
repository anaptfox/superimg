//! Container HTTP handler — runs inside a Cloudflare Container.
//! Boot: load manifest → warm engine → validate ffmpeg → listen.
//! POST /render → renderFromBundle → video bytes (Worker + CF CDN handle caching).

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { PlaywrightEngine } from "@superimg/node/internal";
import { renderFromBundle } from "../render-from-bundle.js";
import type { ManifestEntry } from "../render-from-bundle.js";
import type { EncodingOptions } from "@superimg/types";
import { createRenderPlan } from "@superimg/core/engine";
import { buildRenderJob } from "../utils/build-render-job.js";

const execFileAsync = promisify(execFile);

export type Manifest = Record<string, ManifestEntry>;

const MANIFEST_PATH = process.env.SUPERIMG_MANIFEST_PATH ?? "/app/manifest.json";
const PORT = Number(process.env.PORT ?? 8080);
const RENDER_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS ?? 120_000);

function loadManifest(): Manifest {
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  return JSON.parse(raw);
}

async function getFfmpegVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-version"]);
    return stdout.match(/ffmpeg version ([^\s]+)/)?.[1] ?? "unknown";
  } catch {
    return null;
  }
}

function contentTypeForEncoding(encoding?: EncodingOptions): string {
  switch (encoding?.format) {
    case "gif": return "image/gif";
    case "webm": return "video/webm";
    default: return "video/mp4";
  }
}

async function main() {
  process.on("uncaughtException", (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = msg.toLowerCase().includes("memory") ? " (possible OOM — increase container memory)" : "";
    console.error(`[superimg] uncaughtException:${hint}`, msg);
    process.exit(1);
  });

  const manifest = loadManifest();
  const templateNames = Object.keys(manifest);
  console.log(`[superimg] Manifest loaded. Templates: ${templateNames.join(", ")}`);

  const ffmpegVersion = await getFfmpegVersion();
  if (!ffmpegVersion) {
    console.error("[superimg] ffmpeg not found — container image misconfigured");
    process.exit(1);
  }

  const engine = new PlaywrightEngine({ perRenderContext: true });
  await engine.init();

  console.log(`[superimg] Ready. ffmpeg=${ffmpegVersion} port=${PORT}`);

  const app = new Hono();

  app.get("/healthz", async (c) => {
    const ffmpeg = await getFfmpegVersion();
    return c.json({ ok: true, ffmpeg: ffmpeg ?? "missing", templates: templateNames });
  });

  // GET /info/:template — returns template metadata without rendering.
  // Used by renderDistributed to calculate chunk boundaries.
  app.get("/info/:template", async (c) => {
    const templateName = c.req.param("template");
    const entry = manifest[templateName];
    if (!entry) {
      return c.json(
        { error: "template_not_found", message: `Template "${templateName}" not in manifest.` },
        404
      );
    }
    try {
      const { job } = buildRenderJob({
        parsed: entry.parsed,
        templateBundle: entry.bundle,
        templateDir: "",
        assetBaseUrl: engine.getBaseUrl(),
        autoDiscovered: [],
        overrides: {},
      });
      const plan = await createRenderPlan(job);
      return c.json({
        totalFrames: plan.totalFrames,
        fps: plan.fps,
        durationSeconds: plan.durationSeconds,
        width: plan.width,
        height: plan.height,
      });
    } catch (err) {
      return c.json({ error: "plan_failed", message: (err as Error).message }, 422);
    }
  });

  app.post("/render", async (c) => {
    let body: {
      template?: string;
      data?: Record<string, unknown>;
      encoding?: EncodingOptions;
      startFrame?: number;
      endFrame?: number;
    } | null = null;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "bad_request", message: "Request body must be JSON." }, 400);
    }

    if (!body?.template) {
      return c.json({ error: "bad_request", message: "Missing required field: 'template'." }, 400);
    }

    const { template: templateName, data, encoding, startFrame, endFrame } = body;
    const isChunk = startFrame !== undefined || endFrame !== undefined;
    const entry = manifest[templateName];

    if (!entry) {
      return c.json(
        {
          error: "template_not_found",
          message: `Template "${templateName}" is not in the manifest.`,
          hint: `Available: ${templateNames.join(", ")}. Redeploy to add new templates.`,
        },
        404
      );
    }

    const requestId = crypto.randomUUID().slice(0, 8);
    const startMs = Date.now();
    const rangeLabel = isChunk ? ` [frames ${startFrame}–${endFrame}]` : "";
    console.log(`[${requestId}] render start: ${templateName}${rangeLabel}`);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);

    try {
      // For chunk renders, strip audio — orchestrator muxes audio post-stitch.
      const chunkEncoding =
        isChunk && encoding
          ? (({ audio: _audio, ...rest }) => rest)(encoding)
          : encoding;
      const bytes = await Promise.race([
        renderFromBundle(entry, {
          engine,
          ...(data !== undefined ? { data } : {}),
          ...(chunkEncoding !== undefined ? { encoding: chunkEncoding } : {}),
          ...(startFrame !== undefined ? { startFrame } : {}),
          ...(endFrame !== undefined ? { endFrame } : {}),
        }),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener("abort", () => reject(new Error("render_timeout")))
        ),
      ]);

      clearTimeout(timeoutHandle);
      console.log(`[${requestId}] done in ${Date.now() - startMs}ms (${bytes.byteLength} bytes)`);

      return new Response(bytes.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": contentTypeForEncoding(encoding),
          "Content-Length": String(bytes.byteLength),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      clearTimeout(timeoutHandle);
      const message = err instanceof Error ? err.message : String(err);
      const elapsed = Date.now() - startMs;

      if (message === "render_timeout") {
        console.error(`[${requestId}] timeout after ${elapsed}ms`);
        return c.json({ error: "timeout", message: "Render exceeded time limit." }, 504);
      }

      console.error(`[${requestId}] render failed after ${elapsed}ms:`, message);
      return c.json({ error: "render_failed", message }, 422);
    }
  });

  serve({ fetch: app.fetch, port: PORT });
  console.log(`[superimg] Listening on :${PORT}`);
}

main();
