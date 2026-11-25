//! Same-origin, session-scoped local media jobs for the development server.

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { bundleMediaProgram } from "@superimg/core/bundler";
import {
  createRuntime,
  inspectFile,
  readByteStream,
  startConversion,
  startExport,
} from "@superimg/core/runtime";
import { compileTemplate } from "@superimg/core";
import { createNodeRuntimeAdapter } from "@superimg/node";
import type {
  ConversionRequest,
  ExportOptions,
  ExportableMedia,
  ExportBundle,
  ConversionArtifact,
  JobEvent,
  JobState,
  PausableJob,
} from "@superimg/types";

const COOKIE = "superimg_dev_session";
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const MAX_SESSION_UPLOAD_BYTES = 512 * 1024 * 1024;
const MAX_SESSION_JOBS = 32;
const EVENT_RING_SIZE = 1024;

type StoredFile = { bytes: Uint8Array; mimeType: string; filename: string; inspection: unknown };
type StoredArtifact = { bytes: Uint8Array; mimeType: string; filename: string };
type JobRow = {
  id: string;
  job: PausableJob<unknown>;
  state: JobState;
  events: Array<{ sequence: number; event: JobEvent }>;
  artifacts: StoredArtifact[];
  unsubscribe: () => void;
  listeners: Set<(item: { sequence: number; event: JobEvent }) => void>;
};

export interface DevMediaApi {
  handle(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean>;
  dispose(): Promise<void>;
}

export function createDevMediaApi(input: {
  readonly origin: string;
  readonly sources: ReadonlyMap<string, string>;
  readonly collectionRoute?: (req: IncomingMessage, res: ServerResponse, pathname: string, authorize: (req: IncomingMessage, res: ServerResponse) => boolean) => Promise<boolean>;
}): DevMediaApi {
  const runtime = createRuntime(createNodeRuntimeAdapter());
  let capabilityProbe: Promise<Record<string, unknown>> | undefined;
  const sessions = new Map<string, { token: string; files: Map<string, StoredFile>; jobs: Map<string, JobRow> }>();

  const sessionFor = (req: IncomingMessage, res: ServerResponse, create = false) => {
    const id = cookie(req.headers.cookie, COOKIE);
    let session = id ? sessions.get(id) : undefined;
    if (!session && create) {
      const next = randomUUID();
      session = { token: randomUUID(), files: new Map(), jobs: new Map() };
      sessions.set(next, session);
      res.setHeader("Set-Cookie", `${COOKIE}=${next}; HttpOnly; SameSite=Strict; Path=/`);
    }
    return session;
  };
  const authorizeMutation = (req: IncomingMessage, res: ServerResponse) => {
    const session = sessionFor(req, res);
    const origin = req.headers.origin;
    if (!session || origin !== input.origin || req.headers["x-superimg-session"] !== session.token) {
      json(res, 403, { error: "session_forbidden" });
      return undefined;
    }
    return session;
  };

  const start = async (session: NonNullable<ReturnType<typeof sessionFor>>, body: unknown) => {
    if (!isRecord(body) || (body.kind !== "export" && body.kind !== "conversion")) throw new TypeError("Invalid media job request");
    if (session.jobs.size >= MAX_SESSION_JOBS) throw new TypeError(`Session job limit (${MAX_SESSION_JOBS}) reached`);
    let job: PausableJob<ExportBundle | ConversionArtifact>;
    if (body.kind === "export") {
      if (typeof body.sourceId !== "string") throw new TypeError("Export requires sourceId");
      const source = input.sources.get(body.sourceId);
      if (!source) throw new TypeError("Unknown authored source");
      const bundle = await bundleMediaProgram(source);
      const compiled = compileTemplate(bundle);
      if (compiled.error || !compiled.media) throw compiled.error ?? new Error("Source is not deterministic media");
      job = startExport(runtime, compiled.media as ExportableMedia, body.options as ExportOptions);
    } else {
      if (!isRecord(body.request) || !Array.isArray(body.request.sources)) throw new TypeError("Conversion requires sources");
      const sources = body.request.sources.map((source) => {
        if (!isRecord(source) || typeof source.id !== "string" || typeof source.fileId !== "string") throw new TypeError("Conversion sources require id and fileId");
        const file = session.files.get(source.fileId);
        if (!file) throw new TypeError("Unknown uploaded file");
        return { id: source.id, input: { kind: "bytes" as const, bytes: file.bytes, mimeType: file.mimeType } };
      });
      const request = { ...body.request, sources } as unknown as ConversionRequest;
      job = startConversion(runtime, request);
    }
    const row: JobRow = { id: job.id, job, state: job.state, events: [], artifacts: [], listeners: new Set(), unsubscribe: () => {} };
    let sequence = 0;
    let completed: JobEvent | undefined;
    const publish = (event: JobEvent) => {
      const item = { sequence: ++sequence, event };
      row.events.push(item);
      if (row.events.length > EVENT_RING_SIZE) row.events.shift();
      for (const listener of row.listeners) listener(item);
    };
    row.unsubscribe = job.subscribe((event) => {
      if (event.state === "succeeded") { completed = event; return; }
      row.state = event.state;
      publish(event);
    });
    session.jobs.set(row.id, row);
    void job.result.then(async (result) => {
      try { row.artifacts = await collectArtifacts(result); } finally { await result.dispose(); }
      row.state = "succeeded";
      if (completed) publish(completed);
    }).catch((error) => {
      if (row.state !== "cancelled" && row.state !== "failed") {
        row.state = "failed";
        publish({ schemaVersion: 0, kind: "@foxworth/superimg/job", jobId: row.id, state: "failed", error: { message: message(error) } });
      }
    });
    return snapshot(row);
  };

  return {
    async handle(req, res, pathname) {
      if (!pathname.startsWith("/api/media/") && !pathname.startsWith("/api/collection/") && !/^\/api\/videos\/.+\/collection\//.test(pathname)) return false;
      if (req.headers.host !== new URL(input.origin).host) { json(res, 403, { error: "host_forbidden" }); return true; }
      if (input.collectionRoute && (pathname.startsWith("/api/collection/") || /^\/api\/videos\/.+\/collection\//.test(pathname)) && await input.collectionRoute(req, res, pathname, (request, response) => !!authorizeMutation(request, response))) return true;
      if (!pathname.startsWith("/api/media/")) return false;
      if (pathname === "/api/media/session" && req.method === "GET") {
        if (req.headers["sec-fetch-site"] === "cross-site") { json(res, 403, { error: "session_forbidden" }); return true; }
        const session = sessionFor(req, res, true)!;
        capabilityProbe ??= probeCapabilities(runtime.capabilities.animated);
        try { json(res, 200, { token: session.token, capabilities: await capabilityProbe }); }
        catch (error) { capabilityProbe = undefined; json(res, 503, { error: message(error) }); }
        return true;
      }
      if (pathname === "/api/media/files" && req.method === "POST") {
        const session = authorizeMutation(req, res); if (!session) return true;
        try {
          const bytes = await readBody(req, MAX_UPLOAD_BYTES);
          const uploadedBytes = [...session.files.values()].reduce((sum, file) => sum + file.bytes.byteLength, 0);
          if (uploadedBytes + bytes.byteLength > MAX_SESSION_UPLOAD_BYTES) throw new TypeError(`Session upload limit (${MAX_SESSION_UPLOAD_BYTES} bytes) exceeded`);
          const filename = decodeURIComponent(String(req.headers["x-superimg-filename"] ?? "upload"));
          const mimeType = String(req.headers["content-type"] ?? "application/octet-stream").split(";", 1)[0]!;
          const inspection = await inspectFile(runtime, { kind: "bytes", bytes, mimeType });
          const id = randomUUID(); session.files.set(id, { bytes, mimeType, filename, inspection });
          json(res, 201, { id, size: bytes.byteLength, mimeType, inspection });
        } catch (error) { json(res, 422, { error: message(error) }); }
        return true;
      }
      if (pathname === "/api/media/jobs" && req.method === "POST") {
        const session = authorizeMutation(req, res); if (!session) return true;
        try { json(res, 202, await start(session, await readJson(req))); } catch (error) { json(res, 422, { error: message(error) }); }
        return true;
      }
      if (pathname === "/api/media/jobs" && req.method === "GET") {
        const session = sessionFor(req, res);
        if (!session) { json(res, 403, { error: "session_forbidden" }); return true; }
        json(res, 200, { jobs: [...session.jobs.values()].map(snapshot) });
        return true;
      }
      const match = pathname.match(/^\/api\/media\/jobs\/([^/]+)(?:\/(events|pause|resume|cancel|artifacts\/(\d+)))?$/);
      if (!match) return false;
      const session = sessionFor(req, res); const row = session?.jobs.get(match[1]!);
      if (!session || !row) { json(res, 404, { error: "job_not_found" }); return true; }
      const action = match[2];
      if (!action && req.method === "GET") { json(res, 200, snapshot(row)); return true; }
      if (action === "events" && req.method === "GET") { serveEvents(req, res, row); return true; }
      if (action?.startsWith("artifacts/") && req.method === "GET") {
        const artifact = row.artifacts[Number(match[3])];
        if (!artifact) { json(res, 404, { error: "artifact_not_found" }); return true; }
        res.writeHead(200, { "Content-Type": artifact.mimeType, "Content-Length": String(artifact.bytes.byteLength), "Content-Disposition": `attachment; filename=${JSON.stringify(artifact.filename)}` }); res.end(artifact.bytes); return true;
      }
      const mutation = authorizeMutation(req, res); if (!mutation) return true;
      if (req.method !== "POST") { json(res, 405, { error: "method_not_allowed" }); return true; }
      try {
        if (action === "pause") await row.job.pause(); else if (action === "resume") await row.job.resume(); else if (action === "cancel") await row.job.cancel("user_cancelled"); else { json(res, 404, { error: "job_action_not_found" }); return true; }
        json(res, 200, snapshot(row));
      } catch (error) { json(res, 409, { error: message(error) }); }
      return true;
    },
    async dispose() {
      for (const session of sessions.values()) for (const row of session.jobs.values()) { row.unsubscribe(); await row.job.cancel("server_closed"); }
      sessions.clear();
      await runtime.dispose();
    },
  };
}

function snapshot(row: JobRow) { return { id: row.id, state: row.state, artifacts: row.artifacts.map((artifact, index) => ({ index, mimeType: artifact.mimeType, filename: artifact.filename, byteLength: artifact.bytes.byteLength })) }; }
function cookie(value: string | undefined, name: string) { return value?.split(";").map((part) => part.trim().split("=", 2)).find(([key]) => key === name)?.[1]; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); }
async function readBody(req: IncomingMessage, max: number) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.byteLength; if (size > max) throw new TypeError("Upload exceeds size limit"); chunks.push(bytes); } return new Uint8Array(Buffer.concat(chunks)); }
async function readJson(req: IncomingMessage) { return JSON.parse(new TextDecoder().decode(await readBody(req, 1_000_000))); }
async function collectArtifacts(result: ExportBundle | ConversionArtifact): Promise<StoredArtifact[]> {
  if ("open" in result) {
    const extension = ({ "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv" } as Record<string, string>)[result.mimeType] ?? "bin";
    return [{ bytes: await readByteStream(result.open()), mimeType: result.mimeType, filename: `conversion.${extension}` }];
  }
  return await Promise.all(result.artifacts.map(async (artifact) => ({
    bytes: await readByteStream(artifact.stream()), mimeType: artifact.mimeType,
    filename: artifact.path.split("/").at(-1) ?? "artifact",
  })));
}

async function probeCapabilities(animated: readonly string[]): Promise<Record<string, unknown>> {
  const media = await import("mediabunny");
  const server = await import("@mediabunny/server");
  server.registerMediabunnyServer();
  (await import("@mediabunny/dts")).registerDtsEncoder();
  const formats = { mp4: new media.Mp4OutputFormat(), webm: new media.WebMOutputFormat(), mov: new media.MovOutputFormat(), mkv: new media.MkvOutputFormat() };
  const codecsByFormat: Record<string, string[]> = {};
  const alphaCodecsByFormat: Record<string, string[]> = {};
  const audioCodecsByFormat: Record<string, string[]> = {};
  for (const [name, format] of Object.entries(formats)) {
    if (!animated.includes(name)) continue;
    codecsByFormat[name] = [];
    alphaCodecsByFormat[name] = [];
    audioCodecsByFormat[name] = [];
    for (const codec of ["aac", "opus", "dts"] as const) {
      if (format.getSupportedAudioCodecs().includes(codec) && await media.canEncodeAudio(codec, { numberOfChannels: 2, sampleRate: 48_000 })) audioCodecsByFormat[name]!.push(codec);
    }
    for (const codec of ["avc", "vp9", "av1", "prores"] as const) {
      if (!format.getSupportedVideoCodecs().includes(codec)) continue;
      if (await media.canEncodeVideo(codec, { width: 64, height: 64 })) codecsByFormat[name]!.push(codec);
      if ((codec === "vp9" || codec === "prores") && await media.canEncodeVideo(codec, { width: 64, height: 64, alpha: "keep" })) alphaCodecsByFormat[name]!.push(codec);
    }
  }
  return { animated: Object.keys(codecsByFormat).filter((format) => codecsByFormat[format]!.length), videoCodecs: [...new Set(Object.values(codecsByFormat).flat())], alpha: Object.values(alphaCodecsByFormat).some((codecs) => codecs.length > 0), codecsByFormat, alphaCodecsByFormat, audioCodecsByFormat };
}
function serveEvents(req: IncomingMessage, res: ServerResponse, row: JobRow) { const after = Number(req.headers["last-event-id"] ?? 0); res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }); const write = (item: { sequence: number; event: JobEvent }) => { if (!res.write(`id: ${item.sequence}\nevent: progress\ndata: ${JSON.stringify(item.event)}\n\n`)) res.end(); }; const first = row.events[0]?.sequence; if (first !== undefined && after < first - 1) res.write(`event: reset\ndata: ${JSON.stringify(snapshot(row))}\n\n`); for (const event of row.events) if (event.sequence > after) write(event); row.listeners.add(write); res.once("close", () => row.listeners.delete(write)); }
