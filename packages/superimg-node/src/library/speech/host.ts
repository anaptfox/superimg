import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type {
  SpeechProvider,
  SpeechSynthesisArtifact,
  SpeechSynthesisRequest,
} from "./contracts.js";
import { sha256, validateWavPcm } from "./wav.js";

export interface SpeechHost {
  synthesize(
    request: SpeechSynthesisRequest,
    options?: Readonly<{ signal?: AbortSignal; refresh?: boolean }>,
  ): Promise<SpeechSynthesisArtifact>;
}
export function createSpeechHost(
  options: Readonly<
    {
      cacheDirectory: string;
      provider: SpeechProvider;
      adapterVersion?: string;
    }
  >,
): SpeechHost {
  const cacheDirectory = resolve(options.cacheDirectory);
  const active = new Map<string, SharedSynthesis>();
  return Object.freeze({
    async synthesize(
      request: SpeechSynthesisRequest,
      call: Readonly<
        { signal?: AbortSignal | undefined; refresh?: boolean | undefined }
      > = {},
    ) {
      assertRequest(request);
      throwIfAborted(call.signal);
      const fingerprint = options.provider.fingerprint(request);
      throwIfAborted(call.signal);
      const cacheKey = digest({
        request,
        provider: options.provider.id,
        version: options.provider.version,
        adapterVersion: options.adapterVersion ?? options.provider.version,
        fingerprint,
      });
      if (!call.refresh) {
        const cached = await readLatest(cacheDirectory, cacheKey);
        if (cached !== undefined) return cached;
      }
      throwIfAborted(call.signal);
      const existing = active.get(cacheKey);
      if (existing !== undefined && !call.refresh) {
        return await subscribe(existing, call.signal);
      }
      if (call.refresh) {
        return await generate(
          cacheDirectory,
          cacheKey,
          request,
          options.provider,
          call.signal,
        );
      }
      const controller = new AbortController();
      const shared: SharedSynthesis = {
        controller,
        subscribers: 0,
        promise: generate(
          cacheDirectory,
          cacheKey,
          request,
          options.provider,
          controller.signal,
        ),
      };
      active.set(cacheKey, shared);
      void shared.promise.finally(() => {
        if (active.get(cacheKey) === shared) active.delete(cacheKey);
      }).catch(() => undefined);
      return await subscribe(shared, call.signal);
    },
  });
}
async function generate(
  root: string,
  cacheKey: string,
  request: SpeechSynthesisRequest,
  provider: SpeechProvider,
  signal?: AbortSignal,
): Promise<SpeechSynthesisArtifact> {
  throwIfAborted(signal);
  const result = await provider.synthesize(
    request,
    signal === undefined ? {} : { signal },
  );
  throwIfAborted(signal);
  const metadata = validateWavPcm(result.wav);
  if (metadata.sampleFrames === 0) {
    throw new Error("Speech WAV contains no audio frames");
  }
  const hash = sha256(result.wav);
  const dir = join(root, cacheKey);
  const finalPath = join(dir, `${hash}.wav`);
  const recordPath = join(dir, `${randomUUID()}.json`);
  const latestPath = join(dir, "latest.json");
  const artifact: SpeechSynthesisArtifact = Object.freeze({
    schemaVersion: 1,
    cacheKey,
    sha256: hash,
    path: finalPath,
    metadata,
    request: freezeJson(request),
    provenance: result.provenance,
    createdAt: new Date().toISOString(),
  });
  await mkdir(dir, { recursive: true });
  const staging = join(dir, `.${hash}.${randomUUID()}.tmp`);
  const latestTmp = join(dir, `.latest.${randomUUID()}.tmp`);
  try {
    throwIfAborted(signal);
    await writeFile(staging, result.wav, { flag: "wx" });
    throwIfAborted(signal);
    await rename(staging, finalPath).catch(async (error) => {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        await rm(staging, { force: true });
      } else throw error;
    });
    throwIfAborted(signal);
    await writeFile(recordPath, JSON.stringify(artifact), { flag: "wx" });
    throwIfAborted(signal);
    await writeFile(latestTmp, JSON.stringify({ record: recordPath }), {
      flag: "wx",
    });
    throwIfAborted(signal);
    await rename(latestTmp, latestPath);
    return artifact;
  } catch (error) {
    await Promise.all([
      rm(staging, { force: true }),
      rm(latestTmp, { force: true }),
      rm(recordPath, { force: true }),
    ]);
    throw error;
  }
}
async function readLatest(
  root: string,
  cacheKey: string,
): Promise<SpeechSynthesisArtifact | undefined> {
  try {
    const latest = JSON.parse(
      await readFile(join(root, cacheKey, "latest.json"), "utf8"),
    ) as { record?: unknown };
    if (typeof latest.record !== "string" || !within(root, latest.record)) {
      return undefined;
    }
    const artifact = JSON.parse(
      await readFile(latest.record, "utf8"),
    ) as SpeechSynthesisArtifact;
    if (
      artifact.cacheKey !== cacheKey ||
      !within(join(root, cacheKey), artifact.path) || !isAbsolute(artifact.path)
    ) return undefined;
    const bytes = await readFile(artifact.path);
    const metadata = validateWavPcm(bytes);
    if (
      sha256(bytes) !== artifact.sha256 ||
      metadata.durationSeconds !== artifact.metadata.durationSeconds ||
      metadata.sampleFrames !== artifact.metadata.sampleFrames
    ) return undefined;
    return Object.freeze(artifact);
  } catch {
    return undefined;
  }
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(sort(value))).digest("hex");
}
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      ).map(([k, v]) => [k, sort(v)]),
    );
  }
  return value;
}
function freezeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function assertRequest(request: SpeechSynthesisRequest): void {
  if (!request.text.trim()) throw new Error("Speech text must not be empty");
  if (!request.voice.trim()) throw new Error("Speech voice must not be empty");
}
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Speech synthesis aborted", "AbortError");
  }
}
function within(root: string, candidate: string): boolean {
  const back = relative(resolve(root), resolve(candidate));
  return back !== "" && back !== ".." &&
    !back.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(back);
}
interface SharedSynthesis {
  readonly controller: AbortController;
  readonly promise: Promise<SpeechSynthesisArtifact>;
  subscribers: number;
}
async function subscribe(
  shared: SharedSynthesis,
  signal: AbortSignal | undefined,
): Promise<SpeechSynthesisArtifact> {
  if (signal?.aborted) {
    shared.controller.abort();
    await shared.promise.catch(() => undefined);
    throw new DOMException("Speech synthesis aborted", "AbortError");
  }
  shared.subscribers += 1;
  return await new Promise<SpeechSynthesisArtifact>((resolve, reject) => {
    let complete = false;
    const release = () => {
      if (complete) return;
      complete = true;
      signal?.removeEventListener("abort", onAbort);
      shared.subscribers -= 1;
      if (shared.subscribers === 0 && !shared.controller.signal.aborted) {
        shared.controller.abort();
      }
    };
    const onAbort = () => {
      release();
      void shared.promise.finally(() =>
        reject(new DOMException("Speech synthesis aborted", "AbortError"))
      ).catch(() => undefined);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    shared.promise.then((value) => {
      release();
      resolve(value);
    }, (error) => {
      release();
      reject(error);
    });
  });
}
