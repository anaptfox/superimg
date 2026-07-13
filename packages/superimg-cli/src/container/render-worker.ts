//! Killable container render worker. One job is executed at a time.

import { readFileSync } from "node:fs";
import { PlaywrightEngine } from "@superimg/node/internal";
import type { EncodingOptions, RenderLimits } from "@superimg/types";
import { renderFromBundle, type ManifestEntry } from "../render-from-bundle.js";
import { createRenderPlan } from "@superimg/core/engine";
import { buildRenderJob } from "../utils/build-render-job.js";

type Manifest = Record<string, ManifestEntry>;

type WorkerRequest =
  | {
      type: "render";
      jobId: string;
      template: string;
      data?: Record<string, unknown>;
      encoding?: EncodingOptions;
      startFrame?: number;
      endFrame?: number;
      deadlineMs?: number;
      limits?: RenderLimits;
      maxOutputBytes?: number;
    }
  | {
      type: "info";
      jobId: string;
      template: string;
      deadlineMs?: number;
      limits?: RenderLimits;
    }
  | { type: "cancel"; jobId: string };

const manifestPath = process.env.SUPERIMG_MANIFEST_PATH ?? "/app/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
const engine = new PlaywrightEngine({
  perRenderContext: true,
  maxRegisteredAssets: Number(process.env.RENDER_MAX_ASSETS ?? 1_000),
});
let active: { jobId: string; controller: AbortController } | null = null;

function send(message: unknown): void {
  process.send?.(message);
}

function errorPayload(error: unknown): { message: string; code?: string } {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown })?.code;
  return {
    message,
    ...(typeof code === "string" ? { code } : {}),
  };
}

async function execute(message: Exclude<WorkerRequest, { type: "cancel" }>): Promise<void> {
  if (active) {
    send({ type: "error", jobId: message.jobId, message: "render worker is busy", code: "worker_busy" });
    return;
  }
  const entry = manifest[message.template];
  if (!entry) {
    send({ type: "error", jobId: message.jobId, message: `Unknown template: ${message.template}`, code: "template_not_found" });
    return;
  }

  const controller = new AbortController();
  active = { jobId: message.jobId, controller };
  try {
    if (message.type === "info") {
      const { job, resolvedAssets, explicitOverrides } = buildRenderJob({
        parsed: entry.parsed,
        templateBundle: entry.bundle,
        templateDir: "",
        assetUrlResolver: (filePath: string) => engine.registerAsset(filePath),
        autoDiscovered: [],
        overrides: {},
      });
      const plan = await createRenderPlan(job, {
        resolvedAssets,
        templateDir: "",
        ...(explicitOverrides !== undefined ? { explicitOverrides } : {}),
        signal: controller.signal,
        ...(message.deadlineMs !== undefined ? { deadlineMs: message.deadlineMs } : {}),
        ...(message.limits !== undefined ? { limits: message.limits } : {}),
      });
      send({
        type: "infoResult",
        jobId: message.jobId,
        info: {
          totalFrames: plan.totalFrames,
          fps: plan.fps,
          durationSeconds: plan.durationSeconds,
          width: plan.width,
          height: plan.height,
        },
      });
      return;
    }

    const bytes = await renderFromBundle(entry, {
      engine,
      signal: controller.signal,
      ...(message.deadlineMs !== undefined ? { deadlineMs: message.deadlineMs } : {}),
      ...(message.data !== undefined ? { data: message.data } : {}),
      ...(message.encoding !== undefined ? { encoding: message.encoding } : {}),
      ...(message.startFrame !== undefined ? { startFrame: message.startFrame } : {}),
      ...(message.endFrame !== undefined ? { endFrame: message.endFrame } : {}),
      ...(message.limits !== undefined ? { limits: message.limits } : {}),
    });
    if (message.maxOutputBytes !== undefined && bytes.byteLength > message.maxOutputBytes) {
      const error = new Error(`output ${bytes.byteLength} bytes exceeds configured maximum ${message.maxOutputBytes}`) as Error & { code: string };
      error.code = "resource_limit";
      throw error;
    }
    send({ type: "renderResult", jobId: message.jobId, bytes: Buffer.from(bytes) });
  } catch (error) {
    send({ type: "error", jobId: message.jobId, ...errorPayload(error) });
  } finally {
    active = null;
    engine.clearRegisteredAssets();
  }
}

process.on("message", (message: WorkerRequest) => {
  if (message.type === "cancel") {
    if (active?.jobId === message.jobId) active.controller.abort();
    return;
  }
  void execute(message);
});

process.on("disconnect", () => {
  active?.controller.abort();
  void engine.dispose().finally(() => process.exit(0));
});

await engine.init();
send({ type: "ready" });
