//! Fallback for containers/codecs not described by Mediabunny's demuxers.

import { VideoSample } from "mediabunny";
import { AvFrameVideoSampleResource } from "@mediabunny/server";
import { AVSEEK_FLAG_BACKWARD, AV_PKT_DATA_DISPLAYMATRIX, AV_FRAME_DATA_DISPLAYMATRIX, Decoder, Demuxer } from "node-av";

export class NodeAvFrameReader {
  private readonly abort = new AbortController();
  private input: Promise<Demuxer>;
  private streams = 0;
  private disposal: Promise<void> | undefined;

  constructor(private readonly path: string, private readonly sourceRotation?: 0 | 90 | 180 | 270) {
    this.input = Demuxer.open(path, { signal: this.abort.signal });
    void this.input.catch(() => undefined);
  }

  async *samples(time: number): AsyncGenerator<VideoSample, void, unknown> {
    this.abort.signal.throwIfAborted();
    if (this.streams++ > 0) {
      // NodeAV's packet iterator keeps its EOF/read-ahead state after seek().
      // Reopen only on an actual seek, never between adjacent frame requests.
      await this.reopen();
    }
    let seekTime = time;
    let lookback = 1;
    while (true) {
      const input = await this.input;
      this.abort.signal.throwIfAborted();
      const stream = input.video();
      if (!stream) throw new Error("No video track in clip");
      // Global seeks use microseconds in NodeAV. Decode forward from the preceding
      // keyframe; the session selects the last presentation timestamp <= time.
      const result = await input.seek(seekTime + input.startTime, -1, AVSEEK_FLAG_BACKWARD);
      if (result < 0) throw new Error(`Could not seek clip to ${time}s (native error ${result})`);
      const decoder = await Decoder.create(stream, { signal: this.abort.signal, applyCropping: true });
      const streamMatrix = stream.codecpar.getCodedSideData(AV_PKT_DATA_DISPLAYMATRIX);
      let retryEarlier = false;
      let first = true;
      try {
        for await (const frame of decoder.frames(input.packets(stream.index))) {
          if (!frame) break;
          const resource = new AvFrameVideoSampleResource(frame);
          let sample: VideoSample;
          try {
            const base = frame.timeBase;
            const matrix = frame.getSideData(AV_FRAME_DATA_DISPLAYMATRIX) ?? streamMatrix;
            const degrees = matrix && matrix.length >= 36
              ? Math.round(Math.atan2(matrix.readInt32LE(4), matrix.readInt32LE(0)) * 180 / Math.PI)
              : 0;
            const normalized = ((degrees % 360) + 360) % 360;
            const rotation = this.sourceRotation ?? (normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0);
            sample = new VideoSample(resource, {
              timestamp: Number(frame.pts) * base.num / base.den - input.startTime,
              duration: Math.max(0, Number(frame.duration) * base.num / base.den),
              rotation,
            });
          } catch (error) {
            resource.close();
            throw error;
          }
          if (first && sample.timestamp > time + 0.500001e-6 && seekTime > 0) {
            // Some containers index decode timestamps, placing a seek after the
            // requested presentation frame. Back up until the covering frame is
            // available; never silently substitute a later frame.
            sample.close();
            retryEarlier = true;
            break;
          }
          first = false;
          yield sample; // Ownership transfers to the session until it advances.
        }
      } finally {
        decoder.close();
      }
      if (!retryEarlier) return;
      seekTime = Math.max(0, time - lookback);
      lookback *= 2;
      await this.reopen();
    }
  }

  private async reopen(): Promise<void> {
    await (await this.input).close();
    this.abort.signal.throwIfAborted();
    this.input = Demuxer.open(this.path, { signal: this.abort.signal });
  }

  dispose(): void {
    if (this.disposal) return;
    this.abort.abort();
    this.disposal = this.input.then((input) => input.close(), () => undefined);
    void this.disposal.catch(() => undefined);
  }

  async settled(): Promise<void> {
    await this.disposal;
  }
}
