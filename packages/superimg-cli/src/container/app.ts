import { Hono } from "hono";
import type {
  EncodingOptions,
  RenderExecutionOptions,
  RenderLimits,
} from "@superimg/types";
import { RenderExecutionError } from "@superimg/types";
import type { ManifestEntry } from "../render-from-bundle.js";
import type { RenderSupervisorRequest } from "./render-supervisor.js";

export type ContainerManifest = Record<string, ManifestEntry>;

export interface ContainerRenderQueue {
  readonly activeCount: number;
  readonly queuedCount: number;
  run(request: RenderSupervisorRequest, options?: RenderExecutionOptions): Promise<unknown>;
}

export interface ContainerAppOptions {
  manifest: ContainerManifest;
  supervisor: ContainerRenderQueue;
  renderTimeoutMs: number;
  cancellationGraceMs: number;
  maxRequestBytes: number;
  maxOutputBytes: number;
  renderLimits: RenderLimits;
  getFfmpegVersion(): Promise<string | null>;
}

interface ContainerRenderBody {
  template?: string;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  startFrame?: number;
  endFrame?: number;
}

function contentTypeForEncoding(encoding?: EncodingOptions): string {
  switch (encoding?.format) {
    case "gif": return "image/gif";
    case "webm": return "video/webm";
    case "mov": return "video/quicktime";
    case "mkv": return "video/x-matroska";
    default: return "video/mp4";
  }
}

export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maximumBytes) {
    throw new RenderExecutionError("resource_limit", `Request exceeds ${maximumBytes} bytes`);
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel("request_too_large");
        throw new RenderExecutionError("resource_limit", `Request exceeds ${maximumBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function statusForExecutionError(error: unknown): number {
  const code = (error as { code?: string })?.code;
  if (code === "queue_full") return 503;
  if (code === "deadline_exceeded") return 504;
  if (code === "aborted") return 408;
  if (code === "resource_limit") return 413;
  if (code === "template_not_found") return 404;
  return 422;
}

export function createContainerApp(options: ContainerAppOptions): Hono {
  const {
    manifest,
    supervisor,
    renderTimeoutMs,
    cancellationGraceMs,
    maxRequestBytes,
    maxOutputBytes,
    renderLimits,
    getFfmpegVersion,
  } = options;
  const templateNames = Object.keys(manifest);
  const app = new Hono();

  app.get("/healthz", async (c) => {
    const ffmpeg = await getFfmpegVersion();
    const profile = ffmpeg ? "node-media" : "node";
    return c.json({
      ok: true,
      /** FFmpeg is optional; null/missing means GIF/embedded-video/stitch paths are unavailable. */
      ffmpeg: ffmpeg ?? null,
      profile,
      capabilities: {
        schemaVersion: 0 as const,
        profile: profile as "node" | "node-media",
        rasterizers: ["playwright", "resvg", "blitz"] as const,
        encoders: ffmpeg
          ? (["mediabunny-node", "ffmpeg"] as const)
          : (["mediabunny-node"] as const),
        decoders: ffmpeg ? (["ffmpeg"] as const) : ([] as const),
        stitchers: ffmpeg
          ? (["mediabunny-node", "ffmpeg"] as const)
          : (["mediabunny-node"] as const),
        processExecution: true,
        filesystem: "temporary" as const,
        versions: { ffmpeg },
      },
      packageHashes: templateNames,
      templates: templateNames,
      activeRenders: supervisor.activeCount,
      queuedRenders: supervisor.queuedCount,
    });
  });

  app.get("/info/:template", async (c) => {
    const templateName = c.req.param("template");
    if (!manifest[templateName]) {
      return c.json(
        { error: "template_not_found", message: `Template "${templateName}" not in manifest.` },
        404,
      );
    }
    try {
      const info = await supervisor.run(
        { type: "info", template: templateName, limits: renderLimits },
        { signal: c.req.raw.signal, deadlineMs: Date.now() + renderTimeoutMs },
      ) as Record<string, number>;
      return c.json(info);
    } catch (error) {
      return c.json(
        { error: (error as { code?: string }).code ?? "plan_failed", message: (error as Error).message },
        statusForExecutionError(error) as 404 | 408 | 413 | 422 | 503 | 504,
      );
    }
  });

  app.post("/render", async (c) => {
    let body: ContainerRenderBody | null = null;
    try {
      body = await readBoundedJson(c.req.raw, maxRequestBytes) as ContainerRenderBody | null;
    } catch (error) {
      const status = statusForExecutionError(error);
      return c.json(
        {
          error: status === 413 ? "resource_limit" : "bad_request",
          message: error instanceof Error ? error.message : "Request body must be JSON.",
        },
        status === 413 ? 413 : 400,
      );
    }

    if (!body?.template) {
      return c.json({ error: "bad_request", message: "Missing required field: 'template'." }, 400);
    }

    const { template: templateName, data, encoding, startFrame, endFrame } = body;
    const isChunk = startFrame !== undefined || endFrame !== undefined;
    if (!manifest[templateName]) {
      return c.json({
        error: "template_not_found",
        message: `Template "${templateName}" is not in the manifest.`,
        hint: `Available: ${templateNames.join(", ")}. Redeploy to add new templates.`,
      }, 404);
    }

    const requestId = crypto.randomUUID().slice(0, 8);
    const startMs = Date.now();
    const rangeLabel = isChunk ? ` [frames ${startFrame}–${endFrame}]` : "";
    console.log(`[${requestId}] render start: ${templateName}${rangeLabel}`);

    try {
      const chunkEncoding = isChunk && encoding
        ? (({ audio: _audio, ...rest }) => rest)(encoding)
        : encoding;
      const bytes = await supervisor.run({
        type: "render",
        template: templateName,
        ...(data !== undefined ? { data } : {}),
        ...(chunkEncoding !== undefined ? { encoding: chunkEncoding } : {}),
        ...(startFrame !== undefined ? { startFrame } : {}),
        ...(endFrame !== undefined ? { endFrame } : {}),
        limits: renderLimits,
        maxOutputBytes,
      }, {
        signal: c.req.raw.signal,
        deadlineMs: Date.now() + renderTimeoutMs,
        cleanupTimeoutMs: cancellationGraceMs,
      }) as Uint8Array;

      console.log(`[${requestId}] done in ${Date.now() - startMs}ms (${bytes.byteLength} bytes)`);
      return new Response(bytes.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": contentTypeForEncoding(encoding),
          "Content-Length": String(bytes.byteLength),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = statusForExecutionError(error);
      console.error(`[${requestId}] render failed after ${Date.now() - startMs}ms (${status}):`, message);
      return c.json(
        { error: (error as { code?: string }).code ?? "render_failed", message },
        status as 404 | 408 | 413 | 422 | 503 | 504,
      );
    }
  });

  return app;
}
