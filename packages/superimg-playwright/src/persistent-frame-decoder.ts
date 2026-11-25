//! Native, reusable clip decoder. Keep this module lazy: importing it loads NodeAV.

import { ALL_FORMATS, FilePathSource, Input, VideoSampleSink, VideoSample } from "mediabunny";
import { AvFrameVideoSampleResource, registerMediabunnyServer, toAvFrame } from "@mediabunny/server";
import { Frame } from "node-av";
import sharp from "sharp";
import type { FrameExtractorBackend, FrameExtractionContext } from "./frame-extractor.js";
import { NodeAvFrameReader } from "./node-av-frame-reader.js";

class DecoderClosedError extends Error {}

/** One demuxer and forward decoder per source version; reverse/large seeks restart at a keyframe. */
class DecoderSession {
  readonly input: Input;
  closed = false;
  private sink: Promise<Pick<VideoSampleSink, "samples">>;
  private fallback: NodeAvFrameReader | undefined;
  private queue: Promise<void> = Promise.resolve();
  private iterator: AsyncGenerator<VideoSample, void, unknown> | undefined;
  private current: VideoSample | undefined;
  private next: VideoSample | undefined;
  private active = false;
  private pending = 0;
  private lastRequested = -Infinity;

  constructor(readonly path: string, readonly version: string) {
    this.input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
    let rotation: 0 | 90 | 180 | 270 | undefined;
    this.sink = this.input.getPrimaryVideoTrack().then(async (track) => {
      if (!track) throw new Error(`No video track in clip: ${path}`);
      rotation = await track.getRotation();
      if (!await track.canDecode()) throw new Error(`No native decoder available for clip: ${path}`);
      return new VideoSampleSink(track, { hardwareAcceleration: "prefer-software" });
    }).catch((error: unknown) => {
      if (this.closed) throw error;
      // NodeAV also supports legacy formats (e.g. MPEG-4 Part 2) absent from
      // Mediabunny's codec map. Preserve those inputs without a CLI subprocess.
      this.input.dispose();
      this.fallback = new NodeAvFrameReader(path, rotation);
      return this.fallback;
    });
    // A queued request may be cancelled before it awaits initialization.
    void this.sink.catch(() => undefined);
  }

  extract(time: number, signal?: AbortSignal): Promise<Buffer> {
    this.pending++;
    const result = this.queue.then(async () => {
      signal?.throwIfAborted();
      if (this.closed) throw new DecoderClosedError();
      this.active = true;
      const abort = () => this.close();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const sink = await this.sink;
        signal?.throwIfAborted();
        if (this.closed) throw new DecoderClosedError();
        // samples() retains decoding state and predecodes a bounded queue. getSample()
        // would construct and flush a fresh decoder for every output timestamp.
        if (!this.iterator || time < this.lastRequested || time - this.lastRequested > 2) {
          await this.resetSamples();
          this.iterator = sink.samples(time);
          this.current = (await this.iterator.next()).value ?? undefined;
          this.next = (await this.iterator.next()).value ?? undefined;
        }
        // Requests are canonicalized to microseconds; native time bases can be
        // finer (e.g. 1/30s). Compare within half that canonical tick.
        while (this.next && this.next.timestamp <= time + 0.500001e-6) {
          this.current?.close();
          this.current = this.next;
          this.next = undefined;
          signal?.throwIfAborted();
          this.next = (await this.iterator!.next()).value ?? undefined;
        }
        this.lastRequested = time;
        signal?.throwIfAborted();
        if (!this.current) throw new Error(`No decoded frame in ${this.path} at ${time}s`);
        // Own an AVFrame reference for conversion. A VideoSample.clone() only
        // shares its resource, and the pinned server transform consumes that
        // backing frame; transforming a retained sample would corrupt later reads.
        const frame = new Frame();
        frame.alloc();
        let owned: VideoSample | undefined;
        try {
          await toAvFrame(this.current, frame);
          owned = new VideoSample(new AvFrameVideoSampleResource(frame), { timestamp: this.current.timestamp });
          const width = owned.codedWidth;
          const height = owned.codedHeight;
          const rgba = Buffer.allocUnsafe(owned.allocationSize({ format: "RGBA" }));
          await owned.copyTo(rgba, { format: "RGBA" });
          signal?.throwIfAborted();
          let pixels = sharp(rgba, { raw: { width, height, channels: 4 } });
          if (this.current.squarePixelWidth !== width || this.current.squarePixelHeight !== height) {
            pixels = pixels.resize(this.current.squarePixelWidth, this.current.squarePixelHeight, { fit: "fill" });
          }
          return await pixels.rotate(this.current.rotation).png({ compressionLevel: 1 }).toBuffer();
        } finally {
          if (owned) owned.close();
          else frame.free();
        }
      } catch (error) {
        this.close();
        signal?.throwIfAborted();
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
        this.active = false;
        if (this.closed) await this.resetSamples();
      }
    });
    this.queue = result.then(() => undefined, () => undefined).finally(() => { this.pending--; });
    return result;
  }

  get idle(): boolean { return this.pending === 0; }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    // Disposing the input interrupts reads/decoding. Held frames are released only
    // after an active pixel copy finishes, never underneath native copyTo().
    this.input.dispose();
    this.fallback?.dispose();
    void this.iterator?.return().catch(() => undefined);
    if (!this.active) void this.resetSamples();
  }

  async settled(): Promise<void> {
    await this.queue;
    if (this.closed) await this.resetSamples();
    await this.fallback?.settled();
  }

  private async resetSamples(): Promise<void> {
    const iterator = this.iterator;
    this.iterator = undefined;
    this.current?.close();
    this.next?.close();
    this.current = undefined;
    this.next = undefined;
    await iterator?.return();
  }
}

export class PersistentFrameDecoder implements FrameExtractorBackend {
  private readonly sessions = new Map<string, DecoderSession>();
  private readonly retired = new Set<Promise<void>>();
  private disposed = false;

  constructor(private readonly maxOpenSources = 4) {
    registerMediabunnyServer();
  }

  async extract(path: string, time: number, signal?: AbortSignal, context?: FrameExtractionContext): Promise<Buffer> {
    const version = context?.sourceVersion ?? path;
    while (true) {
      signal?.throwIfAborted();
      if (this.disposed) throw new Error("Frame decoder is disposed");
      let session = this.sessions.get(path);
      if (session && (session.closed || session.version !== version)) {
        this.sessions.delete(path);
        this.retire(session);
        session = undefined;
      }
      if (!session) {
        if (this.sessions.size >= this.maxOpenSources) {
          const idle = [...this.sessions].find(([, candidate]) => candidate.idle);
          if (idle) {
            this.sessions.delete(idle[0]);
            this.retire(idle[1]);
          } else {
            // Bound open native decoders without evicting a source that another
            // output frame is still reading. Admission is retried after a queue drains.
            await Promise.race([...this.sessions.values()].map((candidate) => candidate.settled()));
            continue;
          }
        }
        session = new DecoderSession(path, version);
        this.sessions.set(path, session);
      } else {
        this.sessions.delete(path);
        this.sessions.set(path, session);
      }
      try {
        return await session.extract(time, signal);
      } catch (error) {
        // A prior cancelled request can retire the decoder while this request was
        // queued. Its independent, non-aborted caller gets a fresh decoder.
        if (error instanceof DecoderClosedError && !this.disposed) continue;
        throw error;
      }
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const session of this.sessions.values()) this.retire(session);
    this.sessions.clear();
    await Promise.allSettled(this.retired);
  }

  private retire(session: DecoderSession): void {
    session.close();
    const settled = session.settled();
    this.retired.add(settled);
    void settled.finally(() => this.retired.delete(settled)).catch(() => undefined);
  }
}
